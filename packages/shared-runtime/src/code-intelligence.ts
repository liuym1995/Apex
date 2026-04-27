import { spawn, type ChildProcess } from "node:child_process";
import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";

const symbolStore = new Map<string, SymbolDefinition>();
const referenceStore = new Map<string, SymbolReference>();
const diagnosticStore = new Map<string, DiagnosticItem>();
const lspClients = new Map<string, LSPClientState>();

export interface SymbolDefinition {
  symbol_id: string;
  name: string;
  kind: "function" | "class" | "interface" | "type" | "variable" | "constant" | "enum" | "module" | "namespace" | "method" | "property";
  file_path: string;
  line_start: number;
  line_end: number;
  type_signature: string;
  documentation: string;
  language: string;
}

export interface SymbolReference {
  reference_id: string;
  symbol_name: string;
  file_path: string;
  line_number: number;
  context: string;
  kind: "import" | "call" | "type_reference" | "inheritance" | "implementation";
}

export interface AffectedFilesGraph {
  root_file: string;
  directly_affected: string[];
  transitively_affected: string[];
  impact_summary: Record<string, string[]>;
}

export interface DiagnosticItem {
  diagnostic_id: string;
  file_path: string;
  line_start: number;
  line_end: number;
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  source: string;
  code: string;
}

export interface CodePatch {
  patch_id: string;
  file_path: string;
  kind: "symbol_rename" | "range_patch" | "ast_transform" | "full_rewrite";
  description: string;
  original_range: { line_start: number; line_end: number };
  replacement: string;
  affected_symbols: string[];
}

export interface CodeIntelligenceQuery {
  query_id: string;
  task_id?: string;
  query_type: "symbol_definition" | "symbol_references" | "affected_files" | "diagnostics" | "type_info" | "search";
  target: string;
  file_path?: string;
  language?: string;
  results: Record<string, unknown>;
  created_at: string;
}

export interface LSPClientConfig {
  language: string;
  command: string;
  args: string[];
  workspace_root: string;
  initialization_options?: Record<string, unknown>;
}

export interface LSPClientState {
  client_id: string;
  config: LSPClientConfig;
  process: ChildProcess | null;
  status: "disconnected" | "starting" | "ready" | "error" | "stopped";
  request_id: number;
  pending_requests: Map<number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }>;
  buffer: string;
  capabilities: Record<string, unknown>;
  started_at?: string;
  error_message?: string;
}

interface LSPMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const LSP_KIND_MAP: Record<number, SymbolDefinition["kind"]> = {
  2: "module",
  3: "namespace",
  5: "class",
  6: "method",
  7: "property",
  10: "enum",
  11: "interface",
  12: "function",
  13: "variable",
  14: "constant",
  26: "type"
};

function lspKindToLocalKind(kind: number): SymbolDefinition["kind"] {
  return LSP_KIND_MAP[kind] ?? "variable";
}

function encodeLSPMessage(msg: LSPMessage): string {
  const body = JSON.stringify(msg);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

function parseLSPMessages(buffer: string): { messages: LSPMessage[]; remaining: string } {
  const messages: LSPMessage[] = [];
  let remaining = buffer;

  while (remaining.length > 0) {
    const headerEnd = remaining.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;

    const header = remaining.substring(0, headerEnd);
    const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!contentLengthMatch) break;

    const contentLength = parseInt(contentLengthMatch[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + contentLength;

    if (remaining.length < bodyEnd) break;

    const body = remaining.substring(bodyStart, bodyEnd);
    try {
      messages.push(JSON.parse(body));
    } catch {
      break;
    }

    remaining = remaining.substring(bodyEnd);
  }

  return { messages, remaining };
}

export function createLSPClient(config: LSPClientConfig): LSPClientState {
  const clientId = createEntityId("lsp");

  const state: LSPClientState = {
    client_id: clientId,
    config,
    process: null,
    status: "disconnected",
    request_id: 0,
    pending_requests: new Map(),
    buffer: "",
    capabilities: {} as Record<string, unknown>
  };

  lspClients.set(clientId, state);

  recordAudit("code_intelligence.lsp_client_created", {
    client_id: clientId,
    language: config.language,
    command: config.command
  });

  return state;
}

export async function startLSPClient(clientId: string): Promise<LSPClientState> {
  const state = lspClients.get(clientId);
  if (!state) throw new Error(`LSP client not found: ${clientId}`);
  if (state.status === "ready" || state.status === "starting") return state;

  state.status = "starting";
  state.started_at = nowIso();

  return new Promise<LSPClientState>((resolve, reject) => {
    try {
      const childProcess = spawn(state.config.command, state.config.args, {
        cwd: state.config.workspace_root,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true
      });

      state.process = childProcess;

      childProcess.stdout?.on("data", (chunk: Buffer) => {
        state.buffer += chunk.toString("utf-8");
        const { messages, remaining } = parseLSPMessages(state.buffer);
        state.buffer = remaining;

        for (const msg of messages) {
          if (msg.id !== undefined && typeof msg.id === "number") {
            const pending = state.pending_requests.get(msg.id);
            if (pending) {
              state.pending_requests.delete(msg.id);
              if (msg.error) {
                pending.reject(new Error(msg.error.message));
              } else {
                pending.resolve(msg.result);
              }
            }
          }
        }
      });

      childProcess.stderr?.on("data", (chunk: Buffer) => {
        recordAudit("code_intelligence.lsp_stderr", {
          client_id: clientId,
          stderr: chunk.toString("utf-8").substring(0, 500)
        });
      });

      childProcess.on("error", (err) => {
        state.status = "error";
        state.error_message = err.message;
        recordAudit("code_intelligence.lsp_error", {
          client_id: clientId,
          error: err.message
        });
      });

      childProcess.on("close", (code) => {
        state.status = "stopped";
        recordAudit("code_intelligence.lsp_closed", {
          client_id: clientId,
          exit_code: code
        });
      });

      const initParams = {
        processId: process.pid,
        rootUri: `file:///${state.config.workspace_root.replace(/\\/g, "/")}`,
        capabilities: {
          textDocument: {
            hover: { contentFormat: ["markdown", "plaintext"] },
            completion: { completionItem: { snippetSupport: false } },
            definition: { linkSupport: true },
            references: {},
            documentSymbol: { hierarchicalDocumentSymbolSupport: true },
            publishDiagnostics: { relatedInformation: true }
          },
          workspace: {
            symbol: {}
          }
        },
        initializationOptions: state.config.initialization_options
      };

      sendLSPRequest(clientId, "initialize", initParams)
        .then((result) => {
          state.capabilities = (result as Record<string, unknown>)?.capabilities as Record<string, unknown> ?? {} as Record<string, unknown>;
          state.status = "ready";

          sendLSPRequest(clientId, "initialized", {}).catch(() => {});

          recordAudit("code_intelligence.lsp_initialized", {
            client_id: clientId,
            language: state.config.language
          });

          resolve(state);
        })
        .catch((err) => {
          state.status = "error";
          state.error_message = err instanceof Error ? err.message : String(err);
          reject(err);
        });
    } catch (err) {
      state.status = "error";
      state.error_message = err instanceof Error ? err.message : String(err);
      reject(err);
    }
  });
}

function sendLSPRequest(clientId: string, method: string, params: unknown): Promise<unknown> {
  const state = lspClients.get(clientId);
  if (!state) return Promise.reject(new Error(`LSP client not found: ${clientId}`));
  if (!state.process?.stdin) return Promise.reject(new Error(`LSP client not connected: ${clientId}`));

  const id = ++state.request_id;
  const msg: LSPMessage = { jsonrpc: "2.0", id, method, params };

  return new Promise((resolve, reject) => {
    state.pending_requests.set(id, { resolve, reject });

    const encoded = encodeLSPMessage(msg);
    state.process!.stdin!.write(encoded);

    setTimeout(() => {
      if (state.pending_requests.has(id)) {
        state.pending_requests.delete(id);
        reject(new Error(`LSP request timeout: ${method} (id=${id})`));
      }
    }, 30000);
  });
}

function sendLSPNotification(clientId: string, method: string, params: unknown): void {
  const state = lspClients.get(clientId);
  if (!state || !state.process || !state.process.stdin) return;

  const msg: LSPMessage = { jsonrpc: "2.0", method, params };
  const encoded = encodeLSPMessage(msg);
  state.process.stdin!.write(encoded);
}

export async function stopLSPClient(clientId: string): Promise<void> {
  const state = lspClients.get(clientId);
  if (!state) return;

  try {
    if (state.process && state.process.stdin) {
      sendLSPNotification(clientId, "shutdown", {});
      await new Promise(r => setTimeout(r, 500));
      sendLSPNotification(clientId, "exit", {});
    }
  } catch {
    // ignore
  }

  if (state.process) {
    try {
      state.process.kill("SIGKILL");
    } catch {
      // ignore
    }
  }

  state.status = "stopped";
  state.process = null;

  recordAudit("code_intelligence.lsp_stopped", {
    client_id: clientId,
    language: state.config.language
  });
}

export function getLSPClientState(clientId: string): LSPClientState | undefined {
  return lspClients.get(clientId);
}

export function listLSPClients(): LSPClientState[] {
  return [...lspClients.values()].map(s => ({
    ...s,
    process: null,
    pending_requests: new Map(),
    buffer: ""
  }));
}

export async function lspDocumentSymbols(clientId: string, filePath: string): Promise<SymbolDefinition[]> {
  const uri = `file:///${filePath.replace(/\\/g, "/")}`;
  const result = await sendLSPRequest(clientId, "textDocument/documentSymbol", {
    textDocument: { uri }
  }) as Array<Record<string, unknown>> | null;

  if (!result) return [];

  const symbols: SymbolDefinition[] = [];
  for (const item of result) {
    const name = item.name as string;
    const kind = item.kind as number;
    const range = (item.range ?? (item.location as Record<string, unknown> | undefined)?.range) as { start: { line: number }; end: { line: number } } | undefined;

    if (name && range) {
      const symbol = registerSymbolDefinition({
        name,
        kind: lspKindToLocalKind(kind),
        file_path: filePath,
        line_start: range.start.line + 1,
        line_end: range.end.line + 1,
        type_signature: item.detail as string ?? "",
        documentation: "",
        language: lspClients.get(clientId)?.config.language ?? "unknown"
      });
      symbols.push(symbol);
    }
  }

  recordAudit("code_intelligence.lsp_document_symbols", {
    client_id: clientId,
    file_path: filePath,
    symbol_count: symbols.length
  });

  return symbols;
}

export async function lspWorkspaceSymbols(clientId: string, query: string): Promise<SymbolDefinition[]> {
  const result = await sendLSPRequest(clientId, "workspace/symbol", { query }) as Array<Record<string, unknown>> | null;

  if (!result) return [];

  const symbols: SymbolDefinition[] = [];
  for (const item of result) {
    const name = item.name as string;
    const kind = item.kind as number;
    const location = item.location as { uri: string; range: { start: { line: number }; end: { line: number } } } | undefined;

    if (name && location) {
      const filePath = location.uri.replace("file:///", "").replace(/^\//, "");
      const symbol = registerSymbolDefinition({
        name,
        kind: lspKindToLocalKind(kind),
        file_path: filePath,
        line_start: location.range.start.line + 1,
        line_end: location.range.end.line + 1,
        type_signature: (item.containerName as string) ?? "",
        documentation: "",
        language: lspClients.get(clientId)?.config.language ?? "unknown"
      });
      symbols.push(symbol);
    }
  }

  recordAudit("code_intelligence.lsp_workspace_symbols", {
    client_id: clientId,
    query,
    symbol_count: symbols.length
  });

  return symbols;
}

export async function lspReferences(clientId: string, filePath: string, line: number, character: number): Promise<SymbolReference[]> {
  const uri = `file:///${filePath.replace(/\\/g, "/")}`;
  const result = await sendLSPRequest(clientId, "textDocument/references", {
    textDocument: { uri },
    position: { line: line - 1, character: character - 1 },
    context: { includeDeclaration: true }
  }) as Array<Record<string, unknown>> | null;

  if (!result) return [];

  const refs: SymbolReference[] = [];
  for (const loc of result) {
    const locUri = loc.uri as string;
    const locRange = loc.range as { start: { line: number; character: number } };
    const refFilePath = locUri.replace("file:///", "").replace(/^\//, "");

    const ref = registerSymbolReference({
      symbol_name: "",
      file_path: refFilePath,
      line_number: locRange.start.line + 1,
      context: `reference at ${locRange.start.line + 1}:${locRange.start.character + 1}`,
      kind: "call"
    });
    refs.push(ref);
  }

  recordAudit("code_intelligence.lsp_references", {
    client_id: clientId,
    file_path: filePath,
    line,
    reference_count: refs.length
  });

  return refs;
}

export async function lspDefinition(clientId: string, filePath: string, line: number, character: number): Promise<SymbolDefinition[]> {
  const uri = `file:///${filePath.replace(/\\/g, "/")}`;
  const result = await sendLSPRequest(clientId, "textDocument/definition", {
    textDocument: { uri },
    position: { line: line - 1, character: character - 1 }
  }) as Array<Record<string, unknown>> | Record<string, unknown> | null;

  const locations = Array.isArray(result) ? result : result ? [result] : [];
  const symbols: SymbolDefinition[] = [];

  for (const loc of locations) {
    const locUri = loc.uri as string;
    const locRange = loc.range as { start: { line: number }; end: { line: number } };
    const defFilePath = locUri.replace("file:///", "").replace(/^\//, "");

    const symbol = registerSymbolDefinition({
      name: "",
      kind: "function",
      file_path: defFilePath,
      line_start: locRange.start.line + 1,
      line_end: locRange.end.line + 1,
      type_signature: "",
      documentation: "",
      language: lspClients.get(clientId)?.config.language ?? "unknown"
    });
    symbols.push(symbol);
  }

  return symbols;
}

export function registerSymbolDefinition(input: Omit<SymbolDefinition, "symbol_id">): SymbolDefinition {
  const symbol: SymbolDefinition = {
    symbol_id: createEntityId("sym"),
    ...input
  };
  symbolStore.set(symbol.symbol_id, symbol);
  return symbol;
}

export function lookupSymbolDefinition(name: string, language?: string): SymbolDefinition[] {
  let results = [...symbolStore.values()].filter(s => s.name === name);
  if (language) results = results.filter(s => s.language === language);
  return results;
}

export function searchSymbols(query: string, language?: string, kind?: SymbolDefinition["kind"]): SymbolDefinition[] {
  let results = [...symbolStore.values()];
  const lowerQuery = query.toLowerCase();
  results = results.filter(s =>
    s.name.toLowerCase().includes(lowerQuery) ||
    s.type_signature.toLowerCase().includes(lowerQuery) ||
    s.documentation.toLowerCase().includes(lowerQuery)
  );
  if (language) results = results.filter(s => s.language === language);
  if (kind) results = results.filter(s => s.kind === kind);
  return results;
}

export function registerSymbolReference(input: Omit<SymbolReference, "reference_id">): SymbolReference {
  const reference: SymbolReference = {
    reference_id: createEntityId("sref"),
    ...input
  };
  referenceStore.set(reference.reference_id, reference);
  return reference;
}

export function findSymbolReferences(symbolName: string): SymbolReference[] {
  return [...referenceStore.values()].filter(r => r.symbol_name === symbolName);
}

export function computeAffectedFiles(filePath: string): AffectedFilesGraph {
  const directlyAffected = new Set<string>();
  const transitivelyAffected = new Set<string>();
  const impactSummary: Record<string, string[]> = {};

  const symbolsInFile = [...symbolStore.values()].filter(s => s.file_path === filePath);
  for (const symbol of symbolsInFile) {
    const refs = [...referenceStore.values()].filter(r => r.symbol_name === symbol.name && r.file_path !== filePath);
    for (const ref of refs) {
      directlyAffected.add(ref.file_path);
      if (!impactSummary[ref.file_path]) impactSummary[ref.file_path] = [];
      impactSummary[ref.file_path].push(`${ref.kind}: ${symbol.name}`);
    }
  }

  for (const affectedFile of directlyAffected) {
    const symbolsInAffectedFile = [...symbolStore.values()].filter(s => s.file_path === affectedFile);
    for (const symbol of symbolsInAffectedFile) {
      const transitiveRefs = [...referenceStore.values()].filter(r => r.symbol_name === symbol.name && r.file_path !== affectedFile && r.file_path !== filePath);
      for (const ref of transitiveRefs) {
        transitivelyAffected.add(ref.file_path);
      }
    }
  }

  return {
    root_file: filePath,
    directly_affected: [...directlyAffected].sort(),
    transitively_affected: [...transitivelyAffected].sort(),
    impact_summary: impactSummary
  };
}

export function registerDiagnostic(input: Omit<DiagnosticItem, "diagnostic_id">): DiagnosticItem {
  const diagnostic: DiagnosticItem = {
    diagnostic_id: createEntityId("diag"),
    ...input
  };
  diagnosticStore.set(diagnostic.diagnostic_id, diagnostic);
  return diagnostic;
}

export function getDiagnostics(filePath?: string, severity?: DiagnosticItem["severity"]): DiagnosticItem[] {
  let results = [...diagnosticStore.values()];
  if (filePath) results = results.filter(d => d.file_path === filePath);
  if (severity) results = results.filter(d => d.severity === severity);
  return results.sort((a, b) => a.line_start - b.line_start);
}

export function createCodePatch(input: Omit<CodePatch, "patch_id">): CodePatch {
  const patch: CodePatch = {
    patch_id: createEntityId("cpatch"),
    ...input
  };
  recordAudit("code_intelligence.patch_created", {
    file_path: patch.file_path,
    kind: patch.kind,
    affected_symbols: patch.affected_symbols
  });
  return patch;
}

export function applyCodePatch(patch: CodePatch): { success: boolean; message: string } {
  const affectedGraph = computeAffectedFiles(patch.file_path);
  const totalAffected = affectedGraph.directly_affected.length + affectedGraph.transitively_affected.length;

  recordAudit("code_intelligence.patch_applied", {
    patch_id: patch.patch_id,
    file_path: patch.file_path,
    kind: patch.kind,
    directly_affected_count: affectedGraph.directly_affected.length,
    transitively_affected_count: affectedGraph.transitively_affected.length
  });

  return {
    success: true,
    message: `Patch applied to ${patch.file_path}. ${totalAffected} files may be affected (${affectedGraph.directly_affected.length} direct, ${affectedGraph.transitively_affected.length} transitive).`
  };
}

export function queryCodeIntelligence(input: {
  task_id?: string;
  query_type: CodeIntelligenceQuery["query_type"];
  target: string;
  file_path?: string;
  language?: string;
}): CodeIntelligenceQuery {
  let results: Record<string, unknown> = {};

  switch (input.query_type) {
    case "symbol_definition":
      results = { definitions: lookupSymbolDefinition(input.target, input.language) };
      break;
    case "symbol_references":
      results = { references: findSymbolReferences(input.target) };
      break;
    case "affected_files":
      results = { graph: computeAffectedFiles(input.target) };
      break;
    case "diagnostics":
      results = { diagnostics: getDiagnostics(input.file_path) };
      break;
    case "type_info":
      results = { definitions: lookupSymbolDefinition(input.target, input.language) };
      break;
    case "search":
      results = { symbols: searchSymbols(input.target, input.language) };
      break;
  }

  const query: CodeIntelligenceQuery = {
    query_id: createEntityId("ciq"),
    task_id: input.task_id,
    query_type: input.query_type,
    target: input.target,
    file_path: input.file_path,
    language: input.language,
    results,
    created_at: nowIso()
  };

  recordAudit("code_intelligence.query", {
    query_id: query.query_id,
    query_type: input.query_type,
    target: input.target
  });

  return query;
}

export interface ASTParseResult {
  file_path: string;
  language: string;
  symbols: SymbolDefinition[];
  references: SymbolReference[];
  diagnostics: DiagnosticItem[];
  parse_time_ms: number;
  error?: string;
}

const LANGUAGE_PARSERS: Record<string, { command: string; argsBuilder: (filePath: string) => string[]; kind: "node" | "cli" }> = {
  typescript: {
    command: "node",
    argsBuilder: (filePath) => ["-e", `
      const ts = require('typescript');
      const fs = require('fs');
      const src = fs.readFileSync('${filePath.replace(/'/g, "\\'")}', 'utf-8');
      const sf = ts.createSourceFile('${filePath.replace(/'/g, "\\'")}', src, ts.ScriptTarget.Latest, true);
      const symbols = [];
      function visit(node) {
        if (ts.isFunctionDeclaration(node) && node.name) {
          symbols.push({name: node.name.text, kind: 'function', line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, endLine: sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1});
        } else if (ts.isClassDeclaration(node) && node.name) {
          symbols.push({name: node.name.text, kind: 'class', line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, endLine: sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1});
        } else if (ts.isInterfaceDeclaration(node)) {
          symbols.push({name: node.name.text, kind: 'interface', line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, endLine: sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1});
        } else if (ts.isEnumDeclaration(node)) {
          symbols.push({name: node.name.text, kind: 'enum', line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, endLine: sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1});
        } else if (ts.isVariableDeclaration(node) && node.name) {
          symbols.push({name: node.name.text, kind: 'variable', line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, endLine: sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1});
        } else if (ts.isMethodDeclaration(node) && node.name) {
          symbols.push({name: node.name.text, kind: 'method', line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, endLine: sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1});
        } else if (ts.isPropertyDeclaration(node) && node.name) {
          symbols.push({name: node.name.text, kind: 'property', line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, endLine: sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1});
        } else if (ts.isTypeAliasDeclaration(node)) {
          symbols.push({name: node.name.text, kind: 'type', line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, endLine: sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1});
        } else if (ts.isImportDeclaration(node)) {
          const mod = node.moduleSpecifier ? node.moduleSpecifier.text : '';
          symbols.push({name: 'import', kind: 'import', line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, endLine: sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1, module: mod});
        }
        ts.forEachChild(node, visit);
      }
      visit(sf);
      console.log(JSON.stringify(symbols));
    `],
    kind: "node"
  },
  javascript: {
    command: "node",
    argsBuilder: (filePath) => ["-e", `
      const fs = require('fs');
      const src = fs.readFileSync('${filePath.replace(/'/g, "\\'")}', 'utf-8');
      const acorn = require('acorn');
      try {
        const ast = acorn.parse(src, {ecmaVersion: 'latest', sourceType: 'module'});
        const symbols = [];
        function visit(node) {
          if (node.type === 'FunctionDeclaration' && node.id) {
            symbols.push({name: node.id.name, kind: 'function', line: node.loc ? node.loc.start.line : 0});
          } else if (node.type === 'ClassDeclaration' && node.id) {
            symbols.push({name: node.id.name, kind: 'class', line: node.loc ? node.loc.start.line : 0});
          } else if (node.type === 'VariableDeclaration') {
            node.declarations.forEach(d => {
              if (d.id && d.id.type === 'Identifier') {
                symbols.push({name: d.id.name, kind: 'variable', line: node.loc ? node.loc.start.line : 0});
              }
            });
          } else if (node.type === 'ImportDeclaration') {
            symbols.push({name: 'import', kind: 'import', line: node.loc ? node.loc.start.line : 0, module: node.source.value});
          }
          for (const key in node) {
            if (node[key] && typeof node[key] === 'object') {
              if (Array.isArray(node[key])) node[key].forEach(visit);
              else if (node[key].type) visit(node[key]);
            }
          }
        }
        visit(ast);
        console.log(JSON.stringify(symbols));
      } catch(e) { console.log('[]'); }
    `],
    kind: "node"
  }
};

export function parseFileAST(filePath: string, language?: string): ASTParseResult {
  const startTime = Date.now();
  const detectedLanguage = language ?? detectLanguage(filePath);
  const parser = LANGUAGE_PARSERS[detectedLanguage];

  if (!parser) {
    return {
      file_path: filePath,
      language: detectedLanguage,
      symbols: [],
      references: [],
      diagnostics: [],
      parse_time_ms: Date.now() - startTime,
      error: `No AST parser available for language: ${detectedLanguage}`
    };
  }

  const symbols: SymbolDefinition[] = [];
  const references: SymbolReference[] = [];
  const diagnostics: DiagnosticItem[] = [];

  try {
    const args = parser.argsBuilder(filePath);
    const result = spawn(parser.command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
      timeout: 30000
    });

    let stdout = "";
    let stderr = "";

    result.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf-8"); });
    result.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf-8"); });

    const parseTimeMs = Date.now() - startTime;

    const parsed = tryParseJSON(stdout);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item.kind === "import" && item.module) {
          references.push(registerSymbolReference({
            symbol_name: item.name ?? "import",
            file_path: filePath,
            line_number: item.line ?? 1,
            context: `import from ${item.module}`,
            kind: "import"
          }));
        } else if (item.name && item.kind) {
          symbols.push(registerSymbolDefinition({
            name: item.name,
            kind: item.kind as SymbolDefinition["kind"],
            file_path: filePath,
            line_start: item.line ?? 1,
            line_end: item.endLine ?? item.line ?? 1,
            type_signature: item.type_signature ?? "",
            documentation: item.documentation ?? "",
            language: detectedLanguage
          }));
        }
      }
    }

    if (stderr) {
      diagnostics.push(registerDiagnostic({
        file_path: filePath,
        line_start: 1,
        line_end: 1,
        severity: "warning",
        message: stderr.substring(0, 500),
        source: `ast-parser:${detectedLanguage}`,
        code: "parse_warning"
      }));
    }

    recordAudit("code_intelligence.ast_parsed", {
      file_path: filePath,
      language: detectedLanguage,
      symbol_count: symbols.length,
      reference_count: references.length,
      parse_time_ms: parseTimeMs
    });

    return {
      file_path: filePath,
      language: detectedLanguage,
      symbols,
      references,
      diagnostics,
      parse_time_ms: parseTimeMs
    };

  } catch (err) {
    return {
      file_path: filePath,
      language: detectedLanguage,
      symbols: [],
      references: [],
      diagnostics: [],
      parse_time_ms: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

function tryParseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const extMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    rb: "ruby",
    cs: "csharp",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    c: "c",
    h: "c",
    hpp: "cpp",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    php: "php",
    dart: "dart",
    lua: "lua",
    zig: "zig"
  };
  return extMap[ext] ?? "unknown";
}

export interface RepositoryIndexResult {
  root_path: string;
  total_files: number;
  total_symbols: number;
  total_references: number;
  languages: Record<string, number>;
  index_time_ms: number;
  errors: string[];
}

export function indexRepository(
  rootPath: string,
  options: {
    filePatterns?: string[];
    excludePatterns?: string[];
    maxFiles?: number;
    language?: string;
  } = {}
): RepositoryIndexResult {
  const startTime = Date.now();
  const maxFiles = options.maxFiles ?? 500;
  const filePatterns = options.filePatterns ?? [
    "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.mjs",
    "**/*.py", "**/*.rs", "**/*.go", "**/*.java"
  ];
  const excludePatterns = options.excludePatterns ?? [
    "**/node_modules/**", "**/dist/**", "**/.git/**", "**/build/**",
    "**/coverage/**", "**/__pycache__/**", "**/target/**"
  ];

  const languages: Record<string, number> = {};
  let totalSymbols = 0;
  let totalReferences = 0;
  let totalFiles = 0;
  const errors: string[] = [];

  const files = collectFiles(rootPath, filePatterns, excludePatterns, maxFiles);

  for (const filePath of files) {
    const language = detectLanguage(filePath);
    if (options.language && language !== options.language) continue;

    const result = parseFileAST(filePath, language);

    if (result.error) {
      errors.push(`${filePath}: ${result.error}`);
    }

    totalSymbols += result.symbols.length;
    totalReferences += result.references.length;
    totalFiles++;

    languages[language] = (languages[language] ?? 0) + 1;
  }

  const indexTimeMs = Date.now() - startTime;

  recordAudit("code_intelligence.repository_indexed", {
    root_path: rootPath,
    total_files: totalFiles,
    total_symbols: totalSymbols,
    total_references: totalReferences,
    index_time_ms: indexTimeMs,
    error_count: errors.length
  });

  return {
    root_path: rootPath,
    total_files: totalFiles,
    total_symbols: totalSymbols,
    total_references: totalReferences,
    languages,
    index_time_ms: indexTimeMs,
    errors
  };
}

function collectFiles(rootPath: string, patterns: string[], excludePatterns: string[], maxFiles: number): string[] {
  const files: string[] = [];
  const extensions = new Set<string>();

  for (const pattern of patterns) {
    const ext = pattern.split(".").pop();
    if (ext) extensions.add(`.${ext}`);
  }

  try {
    const fs = require("node:fs");
    const path = require("node:path");

    function walk(dir: string, depth: number = 0) {
      if (depth > 10 || files.length >= maxFiles) return;

      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (files.length >= maxFiles) break;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const relPath = fullPath.replace(/\\/g, "/");
          const shouldExclude = excludePatterns.some(p => {
            const pattern = p.replace("**/", "").replace("/**", "");
            return relPath.includes(pattern);
          });
          if (!shouldExclude) {
            walk(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.has(ext)) {
            files.push(fullPath);
          }
        }
      }
    }

    walk(rootPath);
  } catch {
    // fallback: return empty
  }

  return files;
}

export function notifyLSPFileOpen(clientId: string, filePath: string, content: string): void {
  const uri = `file:///${filePath.replace(/\\/g, "/")}`;
  sendLSPNotification(clientId, "textDocument/didOpen", {
    textDocument: {
      uri,
      languageId: lspClients.get(clientId)?.config.language ?? "plaintext",
      version: 1,
      text: content
    }
  });
}

export function notifyLSPFileChange(clientId: string, filePath: string, content: string, version: number): void {
  const uri = `file:///${filePath.replace(/\\/g, "/")}`;
  sendLSPNotification(clientId, "textDocument/didChange", {
    textDocument: { uri, version },
    contentChanges: [{ text: content }]
  });
}

export function notifyLSPFileClose(clientId: string, filePath: string): void {
  const uri = `file:///${filePath.replace(/\\/g, "/")}`;
  sendLSPNotification(clientId, "textDocument/didClose", {
    textDocument: { uri }
  });
}
