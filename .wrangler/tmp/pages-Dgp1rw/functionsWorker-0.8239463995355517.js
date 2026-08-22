var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
if (!("__unenv__" in performance)) {
  const proto = Performance.prototype;
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== "constructor" && !(key in performance)) {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (desc) {
        Object.defineProperty(performance, key, desc);
      }
    }
  }
}
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert: assert2,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// api/admin/customer-history.js
async function onRequestPost(context2) {
  try {
    const body = await context2.request.json().catch(() => ({}));
    const suppliedSecret = (body.adminSecret || "").trim();
    const realSecret = context2.env.ADMIN_SECRET || "";
    if (!realSecret || suppliedSecret !== realSecret) {
      return jsonResponse({ ok: false, error: "Not authorized." }, 401);
    }
    const customerId = (body.customerId || "").trim();
    if (!customerId) {
      return jsonResponse({ ok: false, error: "Missing customerId." }, 400);
    }
    const db = context2.env.DB;
    const customer = await db.prepare(
      "SELECT id, name, email, phone, notes, created_at FROM customers WHERE id = ?"
    ).bind(customerId).first();
    if (!customer) {
      return jsonResponse({ ok: false, error: "That customer ID wasn't found." }, 404);
    }
    const { results: licenses } = await db.prepare(
      `SELECT licenses.id, licenses.license_key, licenses.tier, licenses.status,
              licenses.device_id, licenses.device_label, licenses.app_version, licenses.issued_at,
              licenses.activated_at, licenses.last_checkin_at, licenses.expires_at,
              licenses.last_backup_at, licenses.amount, licenses.currency, licenses.is_trial,
              products.id AS product_id, products.name AS product_name
       FROM licenses
       JOIN products ON products.id = licenses.product_id
       WHERE licenses.customer_id = ?
       ORDER BY licenses.issued_at DESC`
    ).bind(customerId).all();
    let events = [];
    if (licenses.length) {
      const placeholders = licenses.map(() => "?").join(",");
      const { results } = await db.prepare(
        `SELECT license_events.id, license_events.license_id, license_events.event_type,
                license_events.detail, license_events.created_at,
                licenses.license_key, products.name AS product_name
         FROM license_events
         JOIN licenses ON licenses.id = license_events.license_id
         JOIN products ON products.id = licenses.product_id
         WHERE license_events.license_id IN (${placeholders})
         ORDER BY license_events.created_at DESC
         LIMIT 200`
      ).bind(...licenses.map((l) => l.id)).all();
      events = results;
    }
    return jsonResponse({ ok: true, customer, licenses, events });
  } catch (err) {
    return jsonResponse({ ok: false, error: "Server error, please try again." }, 500);
  }
}
__name(onRequestPost, "onRequestPost");
function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse, "jsonResponse");

// api/admin/dashboard.js
async function onRequestPost2(context2) {
  try {
    const body = await context2.request.json().catch(() => ({}));
    const suppliedSecret = (body.adminSecret || "").trim();
    const realSecret = context2.env.ADMIN_SECRET || "";
    if (!realSecret || suppliedSecret !== realSecret) {
      return jsonResponse2({ ok: false, error: "Not authorized." }, 401);
    }
    const db = context2.env.DB;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const in30DaysIso = new Date(Date.now() + 30 * 864e5).toISOString();
    const monthStartIso = new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString();
    const totalsRow = await db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM customers) AS totalCustomers,
         (SELECT COUNT(*) FROM licenses) AS totalLicenses,
         (SELECT COUNT(*) FROM licenses WHERE status = 'active' AND (expires_at IS NULL OR expires_at >= ?)) AS activeLicenses,
         (SELECT COUNT(*) FROM licenses WHERE status = 'revoked') AS revokedLicenses,
         (SELECT COUNT(*) FROM licenses WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?) AS expiredLicenses`
    ).bind(nowIso, nowIso).first();
    const { results: expiringSoon } = await db.prepare(
      `SELECT licenses.license_key, licenses.expires_at, licenses.tier,
              customers.id AS customer_id, customers.name AS customer_name,
              products.name AS product_name
       FROM licenses
       JOIN customers ON customers.id = licenses.customer_id
       JOIN products ON products.id = licenses.product_id
       WHERE licenses.status = 'active' AND licenses.expires_at IS NOT NULL
         AND licenses.expires_at >= ? AND licenses.expires_at <= ?
       ORDER BY licenses.expires_at ASC
       LIMIT 20`
    ).bind(nowIso, in30DaysIso).all();
    const { results: recentActivity } = await db.prepare(
      `SELECT license_events.event_type, license_events.detail, license_events.created_at,
              licenses.license_key, customers.name AS customer_name, products.name AS product_name
       FROM license_events
       JOIN licenses ON licenses.id = license_events.license_id
       JOIN customers ON customers.id = licenses.customer_id
       JOIN products ON products.id = licenses.product_id
       ORDER BY license_events.created_at DESC
       LIMIT 20`
    ).all();
    const { results: revenueThisMonth } = await db.prepare(
      `SELECT currency, SUM(amount) AS total, COUNT(*) AS count
       FROM licenses
       WHERE amount IS NOT NULL AND issued_at >= ?
       GROUP BY currency`
    ).bind(monthStartIso).all();
    const fourteenDaysAgoIso = new Date(Date.now() - 14 * 864e5).toISOString();
    const { results: inactiveCustomers } = await db.prepare(
      `SELECT licenses.license_key, licenses.last_checkin_at,
              customers.id AS customer_id, customers.name AS customer_name,
              products.name AS product_name
       FROM licenses
       JOIN customers ON customers.id = licenses.customer_id
       JOIN products ON products.id = licenses.product_id
       WHERE licenses.status = 'active' AND licenses.device_id IS NOT NULL
         AND licenses.last_checkin_at IS NOT NULL AND licenses.last_checkin_at < ?
       ORDER BY licenses.last_checkin_at ASC
       LIMIT 20`
    ).bind(fourteenDaysAgoIso).all();
    const { results: revenueAllTime } = await db.prepare(
      `SELECT currency, SUM(amount) AS total, COUNT(*) AS count
       FROM licenses
       WHERE amount IS NOT NULL
       GROUP BY currency`
    ).all();
    return jsonResponse2({
      ok: true,
      totals: totalsRow,
      expiringSoon,
      inactiveCustomers,
      recentActivity,
      revenueThisMonth,
      revenueAllTime
    });
  } catch (err) {
    return jsonResponse2({ ok: false, error: "Server error, please try again." }, 500);
  }
}
__name(onRequestPost2, "onRequestPost");
function jsonResponse2(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse2, "jsonResponse");

// api/admin/issue.js
async function onRequestPost3(context2) {
  try {
    const body = await context2.request.json();
    const suppliedSecret = (body.adminSecret || "").trim();
    const realSecret = context2.env.ADMIN_SECRET || "";
    if (!realSecret || suppliedSecret !== realSecret) {
      return jsonResponse3({ ok: false, error: "Not authorized." }, 401);
    }
    const productId = (body.productId || "").trim();
    if (!productId) {
      return jsonResponse3({ ok: false, error: "productId is required." }, 400);
    }
    const db = context2.env.DB;
    const product = await db.prepare("SELECT id FROM products WHERE id = ? AND status = 'active'").bind(productId).first();
    if (!product) {
      return jsonResponse3({ ok: false, error: "Unknown or discontinued productId." }, 400);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let customerId = (body.customerId || "").trim();
    if (customerId) {
      const existing = await db.prepare("SELECT id FROM customers WHERE id = ?").bind(customerId).first();
      if (!existing) {
        return jsonResponse3({ ok: false, error: "customerId not found." }, 400);
      }
    } else {
      const customerName = (body.customerName || "").trim();
      if (!customerName) {
        return jsonResponse3({ ok: false, error: "customerName is required when customerId is omitted." }, 400);
      }
      customerId = crypto.randomUUID();
      await db.prepare(
        "INSERT INTO customers (id, name, email, phone, created_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(customerId, customerName, (body.customerEmail || "").trim() || null, (body.customerPhone || "").trim() || null, now).run();
    }
    let licenseKey = (body.licenseKey || "").trim();
    if (licenseKey) {
      const clash = await db.prepare("SELECT id FROM licenses WHERE license_key = ?").bind(licenseKey).first();
      if (clash) {
        return jsonResponse3({ ok: false, error: "That license key is already in use." }, 400);
      }
    } else {
      licenseKey = await generateUniqueLicenseKey(db);
    }
    const isTrial = !!body.isTrial;
    let expiresAt = (body.expiresAt || "").trim() || null;
    if (!expiresAt && isTrial && !body.durationDays) {
      expiresAt = new Date(Date.now() + 14 * 864e5).toISOString();
    }
    if (!expiresAt && body.durationDays) {
      const days = Number(body.durationDays);
      if (!Number.isFinite(days) || days <= 0) {
        return jsonResponse3({ ok: false, error: "durationDays must be a positive number." }, 400);
      }
      expiresAt = new Date(Date.now() + days * 864e5).toISOString();
    }
    if (expiresAt) {
      const parsed = new Date(expiresAt);
      if (isNaN(parsed.getTime())) {
        return jsonResponse3({ ok: false, error: "expiresAt is not a valid date." }, 400);
      }
      expiresAt = parsed.toISOString();
    }
    let amount = null;
    if (body.amount !== void 0 && body.amount !== null && body.amount !== "") {
      amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return jsonResponse3({ ok: false, error: "amount must be a non-negative number." }, 400);
      }
    }
    const currency = amount !== null ? (body.currency || "").trim().toUpperCase() || "INR" : null;
    const licenseId = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO licenses (id, license_key, customer_id, product_id, tier, status, issued_at, expires_at, amount, currency, is_trial)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`
    ).bind(licenseId, licenseKey, customerId, productId, (body.tier || "").trim() || null, now, expiresAt, amount, currency, isTrial ? 1 : 0).run();
    await db.prepare(
      "INSERT INTO license_events (license_id, event_type, detail, created_at) VALUES (?, 'issued', ?, ?)"
    ).bind(licenseId, productId, now).run();
    return jsonResponse3({ ok: true, licenseKey, customerId, licenseId, expiresAt, amount, currency, isTrial });
  } catch (err) {
    return jsonResponse3({ ok: false, error: "Server error, please try again." }, 500);
  }
}
__name(onRequestPost3, "onRequestPost");
async function generateUniqueLicenseKey(db) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function block() {
    let s = "";
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  __name(block, "block");
  for (let attempt = 0; attempt < 5; attempt++) {
    const key = "REST-" + block() + "-" + block() + "-" + block();
    const clash = await db.prepare("SELECT id FROM licenses WHERE license_key = ?").bind(key).first();
    if (!clash) return key;
  }
  throw new Error("Could not generate a unique license key after 5 attempts.");
}
__name(generateUniqueLicenseKey, "generateUniqueLicenseKey");
function jsonResponse3(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse3, "jsonResponse");

// api/admin/label-device.js
async function onRequestPost4(context2) {
  try {
    const body = await context2.request.json().catch(() => ({}));
    const suppliedSecret = (body.adminSecret || "").trim();
    const realSecret = context2.env.ADMIN_SECRET || "";
    if (!realSecret || suppliedSecret !== realSecret) {
      return jsonResponse4({ ok: false, error: "Not authorized." }, 401);
    }
    const licenseKey = (body.licenseKey || "").trim();
    if (!licenseKey) {
      return jsonResponse4({ ok: false, error: "Missing licenseKey." }, 400);
    }
    const db = context2.env.DB;
    const license = await db.prepare("SELECT id FROM licenses WHERE license_key = ?").bind(licenseKey).first();
    if (!license) {
      return jsonResponse4({ ok: false, error: "That license key wasn't found." }, 404);
    }
    const deviceLabel = typeof body.deviceLabel === "string" ? body.deviceLabel.trim() : "";
    await db.prepare("UPDATE licenses SET device_label = ? WHERE id = ?").bind(deviceLabel || null, license.id).run();
    return jsonResponse4({ ok: true, licenseKey, deviceLabel });
  } catch (err) {
    return jsonResponse4({ ok: false, error: "Server error, please try again." }, 500);
  }
}
__name(onRequestPost4, "onRequestPost");
function jsonResponse4(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse4, "jsonResponse");

// api/admin/list.js
async function onRequestPost5(context2) {
  try {
    const body = await context2.request.json().catch(() => ({}));
    const suppliedSecret = (body.adminSecret || "").trim();
    const realSecret = context2.env.ADMIN_SECRET || "";
    if (!realSecret || suppliedSecret !== realSecret) {
      return jsonResponse5({ ok: false, error: "Not authorized." }, 401);
    }
    const db = context2.env.DB;
    const productId = (body.productId || "").trim();
    const search = (body.search || "").trim();
    const conditions = [];
    const args = [];
    if (productId) {
      conditions.push("licenses.product_id = ?");
      args.push(productId);
    }
    if (search) {
      conditions.push(`(
        LOWER(customers.name) LIKE ? OR
        LOWER(COALESCE(customers.email, '')) LIKE ? OR
        LOWER(COALESCE(customers.phone, '')) LIKE ? OR
        LOWER(licenses.license_key) LIKE ?
      )`);
      const needle = "%" + search.toLowerCase() + "%";
      args.push(needle, needle, needle, needle);
    }
    const baseQuery = `
      SELECT licenses.id, licenses.license_key, licenses.tier, licenses.status,
             licenses.device_id, licenses.device_label, licenses.app_version, licenses.db_version,
             licenses.issued_at, licenses.activated_at, licenses.last_checkin_at,
             licenses.expires_at, licenses.last_backup_at, licenses.amount, licenses.currency,
             licenses.is_trial,
             customers.id AS customer_id, customers.name AS customer_name,
             products.id AS product_id, products.name AS product_name
      FROM licenses
      JOIN customers ON customers.id = licenses.customer_id
      JOIN products ON products.id = licenses.product_id
      ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""}
      ORDER BY licenses.issued_at DESC
      LIMIT 500
    `;
    const stmt = args.length ? db.prepare(baseQuery).bind(...args) : db.prepare(baseQuery);
    const { results } = await stmt.all();
    const nowMs = Date.now();
    const isExpired = /* @__PURE__ */ __name((r) => r.expires_at && new Date(r.expires_at).getTime() < nowMs, "isExpired");
    const summary = {
      totalLicenses: results.length,
      active: results.filter((r) => r.status === "active" && !isExpired(r)).length,
      expired: results.filter((r) => r.status === "active" && isExpired(r)).length,
      revoked: results.filter((r) => r.status === "revoked").length,
      activatedDevices: results.filter((r) => !!r.device_id).length,
      uniqueCustomers: new Set(results.map((r) => r.customer_id)).size
    };
    return jsonResponse5({ ok: true, summary, licenses: results });
  } catch (err) {
    return jsonResponse5({ ok: false, error: "Server error, please try again." }, 500);
  }
}
__name(onRequestPost5, "onRequestPost");
function jsonResponse5(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse5, "jsonResponse");

// api/admin/notes.js
async function onRequestPost6(context2) {
  try {
    const body = await context2.request.json().catch(() => ({}));
    const suppliedSecret = (body.adminSecret || "").trim();
    const realSecret = context2.env.ADMIN_SECRET || "";
    if (!realSecret || suppliedSecret !== realSecret) {
      return jsonResponse6({ ok: false, error: "Not authorized." }, 401);
    }
    const customerId = (body.customerId || "").trim();
    if (!customerId) {
      return jsonResponse6({ ok: false, error: "Missing customerId." }, 400);
    }
    const db = context2.env.DB;
    const existing = await db.prepare("SELECT id FROM customers WHERE id = ?").bind(customerId).first();
    if (!existing) {
      return jsonResponse6({ ok: false, error: "That customer ID wasn't found." }, 404);
    }
    const notes = typeof body.notes === "string" ? body.notes : "";
    await db.prepare("UPDATE customers SET notes = ? WHERE id = ?").bind(notes || null, customerId).run();
    return jsonResponse6({ ok: true, customerId, notes });
  } catch (err) {
    return jsonResponse6({ ok: false, error: "Server error, please try again." }, 500);
  }
}
__name(onRequestPost6, "onRequestPost");
function jsonResponse6(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse6, "jsonResponse");

// api/admin/products.js
async function onRequestPost7(context2) {
  try {
    const body = await context2.request.json();
    const suppliedSecret = (body.adminSecret || "").trim();
    const realSecret = context2.env.ADMIN_SECRET || "";
    if (!realSecret || suppliedSecret !== realSecret) {
      return jsonResponse7({ ok: false, error: "Not authorized." }, 401);
    }
    const db = context2.env.DB;
    const action = (body.action || "list").trim();
    if (action === "list") {
      const { results } = await db.prepare(
        "SELECT id, name, current_version, status, created_at FROM products ORDER BY created_at ASC"
      ).all();
      return jsonResponse7({ ok: true, products: results });
    }
    if (action === "create") {
      const id = (body.id || "").trim();
      const name = (body.name || "").trim();
      if (!id || !name) {
        return jsonResponse7({ ok: false, error: "id and name are required." }, 400);
      }
      const clash = await db.prepare("SELECT id FROM products WHERE id = ?").bind(id).first();
      if (clash) {
        return jsonResponse7({ ok: false, error: "A product with that id already exists." }, 400);
      }
      await db.prepare(
        "INSERT INTO products (id, name, current_version, status, created_at) VALUES (?, ?, ?, 'active', ?)"
      ).bind(id, name, (body.currentVersion || "").trim() || null, (/* @__PURE__ */ new Date()).toISOString()).run();
      return jsonResponse7({ ok: true, id, name });
    }
    return jsonResponse7({ ok: false, error: "Unknown action." }, 400);
  } catch (err) {
    return jsonResponse7({ ok: false, error: "Server error, please try again." }, 500);
  }
}
__name(onRequestPost7, "onRequestPost");
function jsonResponse7(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse7, "jsonResponse");

// api/admin/revoke.js
async function onRequestPost8(context2) {
  try {
    const body = await context2.request.json();
    const suppliedSecret = (body.adminSecret || "").trim();
    const realSecret = context2.env.ADMIN_SECRET || "";
    if (!realSecret || suppliedSecret !== realSecret) {
      return jsonResponse8({ ok: false, error: "Not authorized." }, 401);
    }
    const licenseKey = (body.licenseKey || "").trim();
    const action = (body.action || "").trim();
    const validActions = ["revoke", "reactivate", "unbind", "renew"];
    if (!licenseKey || !validActions.includes(action)) {
      return jsonResponse8({ ok: false, error: "Missing license key or action." }, 400);
    }
    const db = context2.env.DB;
    const license = await db.prepare(
      `SELECT licenses.*, customers.name AS customer_name
       FROM licenses JOIN customers ON customers.id = licenses.customer_id
       WHERE licenses.license_key = ?`
    ).bind(licenseKey).first();
    if (!license) {
      return jsonResponse8({ ok: false, error: "That license key wasn't found." }, 404);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let newStatus = license.status;
    let newDeviceId = license.device_id;
    let newActivatedAt = license.activated_at;
    let newUnboundAt = license.unbound_at;
    let newExpiresAt = license.expires_at;
    if (action === "renew") {
      const explicitDate = body.newExpiresAt;
      if (explicitDate !== void 0) {
        const trimmed = String(explicitDate).trim();
        if (trimmed === "") {
          newExpiresAt = null;
        } else {
          const parsed = new Date(trimmed);
          if (isNaN(parsed.getTime())) {
            return jsonResponse8({ ok: false, error: "newExpiresAt is not a valid date." }, 400);
          }
          newExpiresAt = parsed.toISOString();
        }
      } else if (body.extendDays) {
        const days = Number(body.extendDays);
        if (!Number.isFinite(days) || days <= 0) {
          return jsonResponse8({ ok: false, error: "extendDays must be a positive number." }, 400);
        }
        const currentExpiry = license.expires_at ? new Date(license.expires_at).getTime() : 0;
        const base = Math.max(currentExpiry, Date.now());
        newExpiresAt = new Date(base + days * 864e5).toISOString();
      } else {
        return jsonResponse8({ ok: false, error: "Provide either extendDays or newExpiresAt to renew." }, 400);
      }
      var clearTrial = !!body.clearTrial;
      await db.prepare(
        "UPDATE licenses SET expires_at = ?, status_changed_at = ?" + (clearTrial ? ", is_trial = 0" : "") + " WHERE id = ?"
      ).bind(newExpiresAt, now, license.id).run();
    } else if (action === "revoke") {
      newStatus = "revoked";
      await db.prepare("UPDATE licenses SET status = 'revoked', status_changed_at = ? WHERE id = ?").bind(now, license.id).run();
    } else if (action === "reactivate") {
      newStatus = "active";
      await db.prepare("UPDATE licenses SET status = 'active', status_changed_at = ? WHERE id = ?").bind(now, license.id).run();
    } else if (action === "unbind") {
      newDeviceId = null;
      newActivatedAt = null;
      newUnboundAt = now;
      await db.prepare("UPDATE licenses SET device_id = NULL, activated_at = NULL, unbound_at = ? WHERE id = ?").bind(now, license.id).run();
    }
    if (action !== "renew") {
      await db.prepare(
        "INSERT INTO license_events (license_id, event_type, detail, created_at) VALUES (?, ?, ?, ?)"
      ).bind(license.id, action === "revoke" ? "revoked" : action === "reactivate" ? "reactivated" : "unbound", "", now).run();
    }
    return jsonResponse8({
      ok: true,
      licenseKey,
      customerName: license.customer_name,
      status: newStatus,
      deviceId: newDeviceId,
      expiresAt: newExpiresAt,
      isTrial: action === "renew" && clearTrial ? false : !!license.is_trial
    });
  } catch (err) {
    return jsonResponse8({ ok: false, error: "Server error, please try again." }, 500);
  }
}
__name(onRequestPost8, "onRequestPost");
function jsonResponse8(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse8, "jsonResponse");

// api/backup/restore.js
async function onRequestOptions(context2) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(onRequestOptions, "onRequestOptions");
async function onRequestPost9(context2) {
  try {
    const body = await context2.request.json();
    const licenseKey = (body.licenseKey || "").trim();
    const productId = (body.productId || "").trim();
    const deviceId = (body.deviceId || "").trim();
    if (!licenseKey || !productId || !deviceId) {
      return jsonResponse9({ ok: false, error: "Missing licenseKey, productId, or deviceId." }, 400);
    }
    const db = context2.env.DB;
    const license = await db.prepare(
      `SELECT id, customer_id, status, device_id, last_backup_at FROM licenses WHERE license_key = ? AND product_id = ?`
    ).bind(licenseKey, productId).first();
    if (!license) {
      return jsonResponse9({ ok: false, error: "License not found for this product." }, 404);
    }
    if (license.status === "revoked") {
      return jsonResponse9({ ok: false, error: "This license has been revoked." }, 403);
    }
    if (license.device_id !== deviceId) {
      return jsonResponse9({ ok: false, error: "This device is not the one bound to this license." }, 403);
    }
    const r2Key = `${license.customer_id}/${productId}/${licenseKey}/latest.db`;
    const obj = await context2.env.BACKUPS.get(r2Key);
    if (!obj) {
      return jsonResponse9({ ok: false, error: "No cloud backup found for this license yet." }, 404);
    }
    const bytes = new Uint8Array(await obj.arrayBuffer());
    const backupData = bytesToBase64(bytes);
    return jsonResponse9({
      ok: true,
      backupData,
      backedUpAt: obj.customMetadata && obj.customMetadata.backedUpAt || license.last_backup_at || null
    });
  } catch (err) {
    return jsonResponse9({ ok: false, error: "Server error, please try again." }, 500);
  }
}
__name(onRequestPost9, "onRequestPost");
function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
__name(bytesToBase64, "bytesToBase64");
function jsonResponse9(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(jsonResponse9, "jsonResponse");

// api/backup/upload.js
async function onRequestOptions2(context2) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(onRequestOptions2, "onRequestOptions");
async function onRequestPost10(context2) {
  try {
    const body = await context2.request.json();
    const licenseKey = (body.licenseKey || "").trim();
    const productId = (body.productId || "").trim();
    const deviceId = (body.deviceId || "").trim();
    const backupData = body.backupData || "";
    if (!licenseKey || !productId || !deviceId || !backupData) {
      return jsonResponse10({ ok: false, error: "Missing licenseKey, productId, deviceId, or backupData." }, 400);
    }
    const db = context2.env.DB;
    const license = await db.prepare(
      `SELECT id, customer_id, status, device_id FROM licenses WHERE license_key = ? AND product_id = ?`
    ).bind(licenseKey, productId).first();
    if (!license) {
      return jsonResponse10({ ok: false, error: "License not found for this product." }, 404);
    }
    if (license.status === "revoked") {
      return jsonResponse10({ ok: false, error: "This license has been revoked." }, 403);
    }
    if (license.device_id !== deviceId) {
      return jsonResponse10({ ok: false, error: "This device is not the one bound to this license." }, 403);
    }
    let bytes;
    try {
      bytes = base64ToBytes(backupData);
    } catch (e) {
      return jsonResponse10({ ok: false, error: "Corrupted backup data." }, 400);
    }
    const r2Key = `${license.customer_id}/${productId}/${licenseKey}/latest.db`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await context2.env.BACKUPS.put(r2Key, bytes, {
      customMetadata: { backedUpAt: now, deviceId }
    });
    await db.prepare(`UPDATE licenses SET last_backup_at = ? WHERE id = ?`).bind(now, license.id).run();
    return jsonResponse10({ ok: true, backedUpAt: now, sizeBytes: bytes.length });
  } catch (err) {
    return jsonResponse10({ ok: false, error: "Server error, please try again." }, 500);
  }
}
__name(onRequestPost10, "onRequestPost");
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
__name(base64ToBytes, "base64ToBytes");
function jsonResponse10(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(jsonResponse10, "jsonResponse");

// api/activate.js
async function onRequestOptions3(context2) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(onRequestOptions3, "onRequestOptions");
async function onRequestPost11(context2) {
  try {
    const body = await context2.request.json();
    const licenseKey = (body.licenseKey || "").trim();
    const productId = (body.productId || "").trim();
    const deviceId = (body.deviceId || "").trim();
    const appVersion = (body.appVersion || "").trim() || null;
    const dbVersion = (body.dbVersion || "").trim() || null;
    if (!licenseKey || !productId || !deviceId) {
      return jsonResponse11({ ok: false, error: "Missing licenseKey, productId, or deviceId." }, 400);
    }
    const db = context2.env.DB;
    const license = await db.prepare(
      `SELECT licenses.*, customers.name AS customer_name
       FROM licenses JOIN customers ON customers.id = licenses.customer_id
       WHERE licenses.license_key = ? AND licenses.product_id = ?`
    ).bind(licenseKey, productId).first();
    if (!license) {
      return jsonResponse11({ ok: false, error: "That license key wasn't found for this product." }, 404);
    }
    if (license.status === "revoked") {
      await logEvent(db, license.id, "activation_denied", "revoked");
      return jsonResponse11({ ok: false, revoked: true, error: "This license has been revoked. Contact support." }, 403);
    }
    if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) {
      await logEvent(db, license.id, "activation_denied", "expired");
      return jsonResponse11({ ok: false, expired: true, error: "This license has expired. Contact support to renew." }, 403);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (!license.device_id) {
      await db.prepare(
        `UPDATE licenses SET device_id = ?, activated_at = ?, app_version = ?, db_version = ?, last_checkin_at = ?
         WHERE id = ?`
      ).bind(deviceId, now, appVersion, dbVersion, now, license.id).run();
      await logEvent(db, license.id, "activated", deviceId);
      return jsonResponse11({
        ok: true,
        licenseKey,
        customerName: license.customer_name,
        tier: license.tier,
        activatedAt: now
      });
    }
    if (license.device_id === deviceId) {
      await db.prepare(
        `UPDATE licenses SET app_version = ?, db_version = ?, last_checkin_at = ? WHERE id = ?`
      ).bind(appVersion, dbVersion, now, license.id).run();
      await logEvent(db, license.id, "heartbeat", appVersion || "");
      return jsonResponse11({
        ok: true,
        licenseKey,
        customerName: license.customer_name,
        tier: license.tier,
        activatedAt: license.activated_at
      });
    }
    await logEvent(db, license.id, "activation_denied", "device_mismatch:" + deviceId);
    return jsonResponse11({ ok: false, error: "This license is already activated on a different device." }, 409);
  } catch (err) {
    return jsonResponse11({ ok: false, error: "Server error, please try again." }, 500);
  }
}
__name(onRequestPost11, "onRequestPost");
async function logEvent(db, licenseId, eventType, detail) {
  await db.prepare(
    `INSERT INTO license_events (license_id, event_type, detail, created_at) VALUES (?, ?, ?, ?)`
  ).bind(licenseId, eventType, detail || "", (/* @__PURE__ */ new Date()).toISOString()).run();
}
__name(logEvent, "logEvent");
function jsonResponse11(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(jsonResponse11, "jsonResponse");

// ../../.wrangler/tmp/pages-Dgp1rw/functionsRoutes-0.33981752443158453.mjs
var routes = [
  {
    routePath: "/api/admin/customer-history",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/admin/dashboard",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/admin/issue",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/admin/label-device",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/admin/list",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/admin/notes",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/admin/products",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  },
  {
    routePath: "/api/admin/revoke",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost8]
  },
  {
    routePath: "/api/backup/restore",
    mountPath: "/api/backup",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/backup/restore",
    mountPath: "/api/backup",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost9]
  },
  {
    routePath: "/api/backup/upload",
    mountPath: "/api/backup",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions2]
  },
  {
    routePath: "/api/backup/upload",
    mountPath: "/api/backup",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost10]
  },
  {
    routePath: "/api/activate",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions3]
  },
  {
    routePath: "/api/activate",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost11]
  }
];

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count3 = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count3--;
          if (count3 === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count3++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count3)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../../../../Users/samar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env2, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context2 = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env: env2,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context2);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env2["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error3) {
      if (isFailOpen) {
        const response = await env2["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error3;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
