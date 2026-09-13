window.__ModuleLoader__.load({
	id: "@nakamuraia/dsh-plugin-speech",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region ../../../vendor/cosmokit/src/misc.ts
		/** Return true when a value is `null` or `undefined`. */
		function isNullable(value) {
			return value === null || value === void 0;
		}
		/** Return true for non-array object values. */
		function isPlainObject(data) {
			return data && typeof data === "object" && !Array.isArray(data);
		}
		/** Filter object entries and return a new object. */
		function filterKeys(object, filter) {
			return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
		}
		/** Map object values while preserving the original key set. */
		function mapValues(object, transform) {
			return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
		}
		/** Pick selected keys from an object, optionally including `undefined` values. */
		function pick(source, keys, forced) {
			if (!keys) return { ...source };
			const result = {};
			for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
			return result;
		}
		//#endregion
		//#region ../../../vendor/cosmokit/src/types.ts
		/** Test values using `instanceof` with a `toStringTag` fallback. */
		function is(type, value) {
			if (arguments.length === 1) return (value) => is(type, value);
			return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
		}
		function isArrayBufferLike(value) {
			return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
		}
		function isArrayBufferSource(value) {
			return isArrayBufferLike(value) || ArrayBuffer.isView(value);
		}
		let Binary;
		(function(_Binary) {
			_Binary.is = isArrayBufferLike;
			_Binary.isSource = isArrayBufferSource;
			function fromSource(source) {
				if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
				else return source;
			}
			_Binary.fromSource = fromSource;
			function toBase64(source) {
				source = fromSource(source);
				if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
				let binary = "";
				const bytes = new Uint8Array(source);
				for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
				return btoa(binary);
			}
			_Binary.toBase64 = toBase64;
			function fromBase64(source) {
				if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
				return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
			}
			_Binary.fromBase64 = fromBase64;
			function toHex(source) {
				source = fromSource(source);
				if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
				return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
			}
			_Binary.toHex = toHex;
			function fromHex(source) {
				if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
				const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
				const buffer = [];
				for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
				return Uint8Array.from(buffer).buffer;
			}
			_Binary.fromHex = fromHex;
		})(Binary || (Binary = {}));
		Binary.fromBase64;
		Binary.toBase64;
		Binary.fromHex;
		Binary.toHex;
		/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
		function clone(source, refs = /* @__PURE__ */ new Map()) {
			if (!source || typeof source !== "object") return source;
			if (is("Date", source)) return new Date(source.valueOf());
			if (is("RegExp", source)) return new RegExp(source.source, source.flags);
			if (isArrayBufferLike(source)) return source.slice(0);
			if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
			const cached = refs.get(source);
			if (cached) return cached;
			if (Array.isArray(source)) {
				const result = [];
				refs.set(source, result);
				source.forEach((value, index) => {
					result[index] = Reflect.apply(clone, null, [value, refs]);
				});
				return result;
			}
			const result = Object.create(Object.getPrototypeOf(source));
			refs.set(source, result);
			for (const key of Reflect.ownKeys(source)) {
				const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
				if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
				Reflect.defineProperty(result, key, descriptor);
			}
			return result;
		}
		/** Deeply compare arrays, dates, regexps, buffers, and plain object fields. */
		function deepEqual(a, b, strict) {
			if (a === b) return true;
			if (!strict && isNullable(a) && isNullable(b)) return true;
			if (typeof a !== typeof b) return false;
			if (typeof a !== "object") return false;
			if (!a || !b) return false;
			function check(test, then) {
				return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
			}
			return check(Array.isArray, (a, b) => a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
				if (a.byteLength !== b.byteLength) return false;
				const viewA = new Uint8Array(a);
				const viewB = new Uint8Array(b);
				for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
				return true;
			}) ?? Object.keys({
				...a,
				...b
			}).every((key) => deepEqual(a[key], b[key], strict));
		}
		//#endregion
		//#region ../../../vendor/cosmokit/src/time.ts
		let Time;
		(function(_Time) {
			_Time.millisecond = 1;
			const second = _Time.second = 1e3;
			const minute = _Time.minute = second * 60;
			const hour = _Time.hour = minute * 60;
			const day = _Time.day = hour * 24;
			const week = _Time.week = day * 7;
			let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
			function setTimezoneOffset(offset) {
				timezoneOffset = offset;
			}
			_Time.setTimezoneOffset = setTimezoneOffset;
			function getTimezoneOffset() {
				return timezoneOffset;
			}
			_Time.getTimezoneOffset = getTimezoneOffset;
			function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
				if (typeof date === "number") date = new Date(date);
				if (offset === void 0) offset = timezoneOffset;
				return Math.floor((date.valueOf() / minute - offset) / 1440);
			}
			_Time.getDateNumber = getDateNumber;
			function fromDateNumber(value, offset) {
				const date = new Date(value * day);
				if (offset === void 0) offset = timezoneOffset;
				return new Date(+date + offset * minute);
			}
			_Time.fromDateNumber = fromDateNumber;
			const numeric = /\d+(?:\.\d+)?/.source;
			const timeRegExp = new RegExp(`^${[
				"w(?:eek(?:s)?)?",
				"d(?:ay(?:s)?)?",
				"h(?:our(?:s)?)?",
				"m(?:in(?:ute)?(?:s)?)?",
				"s(?:ec(?:ond)?(?:s)?)?"
			].map((unit) => `(${numeric}${unit})?`).join("")}$`);
			function parseTime(source) {
				const capture = timeRegExp.exec(source);
				if (!capture) return 0;
				return (parseFloat(capture[1]) * week || 0) + (parseFloat(capture[2]) * day || 0) + (parseFloat(capture[3]) * hour || 0) + (parseFloat(capture[4]) * minute || 0) + (parseFloat(capture[5]) * second || 0);
			}
			_Time.parseTime = parseTime;
			function parseDate(date) {
				const parsed = parseTime(date);
				if (parsed) date = Date.now() + parsed;
				else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
				else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
				return date ? new Date(date) : /* @__PURE__ */ new Date();
			}
			_Time.parseDate = parseDate;
			function format(ms) {
				const abs = Math.abs(ms);
				if (abs >= day - hour / 2) return Math.round(ms / day) + "d";
				else if (abs >= hour - minute / 2) return Math.round(ms / hour) + "h";
				else if (abs >= minute - second / 2) return Math.round(ms / minute) + "m";
				else if (abs >= second) return Math.round(ms / second) + "s";
				return ms + "ms";
			}
			_Time.format = format;
			function toDigits(source, length = 2) {
				return source.toString().padStart(length, "0");
			}
			_Time.toDigits = toDigits;
			function template(template, time = /* @__PURE__ */ new Date()) {
				return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
			}
			_Time.template = template;
		})(Time || (Time = {}));
		//#endregion
		//#region ../../../vendor/schemastery/src/index.ts
		const kSchema = Symbol.for("schemastery");
		const kValidationError = Symbol.for("ValidationError");
		globalThis.__schemastery_index__ ??= 0;
		globalThis.__schemastery_refs__ = void 0;
		var ValidationError = class extends TypeError {
			options;
			name = "ValidationError";
			constructor(message, options) {
				let prefix = "$";
				for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
				else if (typeof segment === "number") prefix += "[" + segment + "]";
				else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
				if (prefix.startsWith(".")) prefix = prefix.slice(1);
				super((prefix === "$" ? "" : `${prefix} `) + message);
				this.options = options;
			}
			static is(error) {
				return !!error?.[kValidationError];
			}
		};
		Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
		const Schema = function(options) {
			const schema = function(data, options = {}) {
				return Schema.resolve(data, schema, options)[0];
			};
			if (options.refs) {
				const refs = mapValues(options.refs, (options) => new Schema(options));
				const getRef = (uid) => refs[uid];
				for (const key in refs) {
					const options = refs[key];
					options.sKey = getRef(options.sKey);
					options.inner = getRef(options.inner);
					options.list = options.list && options.list.map(getRef);
					options.dict = options.dict && mapValues(options.dict, getRef);
				}
				return refs[options.uid];
			}
			Object.assign(schema, options);
			if (typeof schema.callback === "string") try {
				schema.callback = new Function("return " + schema.callback)();
			} catch {}
			Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
			Object.setPrototypeOf(schema, Schema.prototype);
			schema.meta ||= {};
			schema.toString = schema.toString.bind(schema);
			return schema;
		};
		Schema.prototype = Object.create(Function.prototype);
		Schema.prototype[kSchema] = true;
		Object.defineProperty(Schema.prototype, "~standard", { get() {
			return {
				version: 1,
				vendor: "schemastery",
				validate: (value) => {
					try {
						return { value: Schema.resolve(value, this, {})[0] };
					} catch (error) {
						if (ValidationError.is(error)) return { issues: [{
							message: error.message,
							path: error.options.path
						}] };
						throw error;
					}
				}
			};
		} });
		Schema.ValidationError = ValidationError;
		Schema.prototype.toJSON = function toJSON() {
			if (globalThis.__schemastery_refs__) {
				globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
				return this.uid;
			}
			globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
			globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
			const result = {
				uid: this.uid,
				refs: globalThis.__schemastery_refs__
			};
			globalThis.__schemastery_refs__ = void 0;
			return result;
		};
		Schema.prototype.set = function set(key, value) {
			this.dict[key] = value;
			return this;
		};
		Schema.prototype.push = function push(value) {
			this.list.push(value);
			return this;
		};
		function mergeDesc(original, messages) {
			const result = typeof original === "string" ? { "": original } : { ...original };
			for (const locale in messages) {
				const value = messages[locale];
				if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
				else if (typeof value === "string") result[locale] = value;
			}
			return result;
		}
		function getInner(value) {
			return value?.$value ?? value?.$inner;
		}
		function extractKeys(data) {
			return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
		}
		Schema.prototype.i18n = function i18n(messages) {
			const schema = Schema(this);
			const desc = mergeDesc(schema.meta.description, messages);
			if (Object.keys(desc).length) schema.meta.description = desc;
			if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
				return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
			});
			if (schema.list) schema.list = schema.list.map((inner, index) => {
				return inner.i18n(mapValues(messages, (data = {}) => {
					if (Array.isArray(getInner(data))) return getInner(data)[index];
					if (Array.isArray(data)) return data[index];
					return extractKeys(data);
				}));
			});
			if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
				if (getInner(data)) return getInner(data);
				return extractKeys(data);
			}));
			if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
			return schema;
		};
		Schema.prototype.extra = function extra(key, value) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		};
		for (const key of [
			"required",
			"disabled",
			"collapse",
			"hidden",
			"loose"
		]) Object.assign(Schema.prototype, { [key](value = true) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		} });
		Schema.prototype.deprecated = function deprecated() {
			const schema = Schema(this);
			schema.meta.badges ||= [];
			schema.meta.badges.push({
				text: "deprecated",
				type: "danger"
			});
			return schema;
		};
		Schema.prototype.experimental = function experimental() {
			const schema = Schema(this);
			schema.meta.badges ||= [];
			schema.meta.badges.push({
				text: "experimental",
				type: "warning"
			});
			return schema;
		};
		Schema.prototype.pattern = function pattern(regexp) {
			const schema = Schema(this);
			const pattern = pick(regexp, ["source", "flags"]);
			schema.meta = {
				...schema.meta,
				pattern
			};
			return schema;
		};
		Schema.prototype.simplify = function simplify(value) {
			if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
			if (isNullable(value)) return value;
			if (this.type === "object" || this.type === "dict") {
				const result = {};
				for (const key in value) {
					const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
					if (this.type === "dict" || !isNullable(item)) result[key] = item;
				}
				if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
				return result;
			} else if (this.type === "array" || this.type === "tuple") {
				const result = [];
				value.forEach((value, index) => {
					const schema = this.type === "array" ? this.inner : this.list[index];
					const item = schema ? schema.simplify(value) : value;
					result.push(item);
				});
				return result;
			} else if (this.type === "intersect") {
				const result = {};
				for (const item of this.list) Object.assign(result, item.simplify(value));
				return result;
			} else if (this.type === "union") for (const schema of this.list) try {
				Schema.resolve(value, schema, {});
				return schema.simplify(value);
			} catch {}
			return value;
		};
		Schema.prototype.toString = function toString(inline) {
			return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
		};
		Schema.prototype.role = function role(role, extra) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				role,
				extra
			};
			return schema;
		};
		for (const key of [
			"default",
			"link",
			"comment",
			"description",
			"max",
			"min",
			"step"
		]) Object.assign(Schema.prototype, { [key](value) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		} });
		const resolvers = {};
		Schema.extend = function extend(type, resolve) {
			resolvers[type] = resolve;
		};
		Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
			if (!schema) return [data];
			if (options.ignore?.(data, schema)) return [data];
			if (isNullable(data) && schema.type !== "lazy") {
				if (schema.meta.required) throw new ValidationError(`missing required value`, options);
				let current = schema;
				let fallback = schema.meta.default;
				while (current?.type === "intersect" && isNullable(fallback)) {
					current = current.list[0];
					fallback = current?.meta.default;
				}
				if (isNullable(fallback)) return [data];
				data = clone(fallback);
			}
			const callback = resolvers[schema.type];
			if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
			try {
				return callback(data, schema, options, strict);
			} catch (error) {
				if (!schema.meta.loose) throw error;
				return [schema.meta.default];
			}
		};
		Schema.from = function from(source) {
			if (isNullable(source)) return Schema.any();
			else if ([
				"string",
				"number",
				"boolean"
			].includes(typeof source)) return Schema.const(source).required();
			else if (source[kSchema]) return source;
			else if (typeof source === "function") switch (source) {
				case String: return Schema.string().required();
				case Number: return Schema.number().required();
				case Boolean: return Schema.boolean().required();
				case Function: return Schema.function().required();
				default: return Schema.is(source).required();
			}
			else throw new TypeError(`cannot infer schema from ${source}`);
		};
		Schema.lazy = function lazy(builder) {
			const toJSON = () => {
				if (!schema.inner[kSchema]) {
					schema.inner = schema.builder();
					schema.inner.meta = {
						...schema.meta,
						...schema.inner.meta
					};
				}
				return schema.inner.toJSON();
			};
			const schema = new Schema({
				type: "lazy",
				builder,
				inner: { toJSON }
			});
			return schema;
		};
		Schema.natural = function natural() {
			return Schema.number().step(1).min(0);
		};
		Schema.percent = function percent() {
			return Schema.number().step(.01).min(0).max(1).role("slider");
		};
		Schema.date = function date() {
			return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
				const date = new Date(value);
				if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
				return date;
			}, true)]);
		};
		Schema.regExp = function regExp(flag = "") {
			return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
				try {
					return new RegExp(value, flag);
				} catch (e) {
					throw new ValidationError(e.message, options);
				}
			}, true)]);
		};
		Schema.arrayBuffer = function arrayBuffer(encoding) {
			return Schema.union([
				Schema.is(ArrayBuffer),
				Schema.is(SharedArrayBuffer),
				Schema.transform(Schema.any(), (value, options) => {
					if (Binary.isSource(value)) return Binary.fromSource(value);
					throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
				}, true),
				...encoding ? [Schema.transform(Schema.string(), (value, options) => {
					try {
						return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
					} catch (e) {
						throw new ValidationError(e.message, options);
					}
				}, true)] : []
			]);
		};
		Schema.extend("lazy", (data, schema, options, strict) => {
			if (!schema.inner[kSchema]) {
				schema.inner = schema.builder();
				schema.inner.meta = {
					...schema.meta,
					...schema.inner.meta
				};
			}
			return Schema.resolve(data, schema.inner, options, strict);
		});
		Schema.extend("any", (data) => {
			return [data];
		});
		Schema.extend("never", (data, _, options) => {
			throw new ValidationError(`expected nullable but got ${data}`, options);
		});
		Schema.extend("const", (data, { value }, options) => {
			if (deepEqual(data, value)) return [value];
			throw new ValidationError(`expected ${value} but got ${data}`, options);
		});
		function checkWithinRange(data, meta, description, options, skipMin = false) {
			const { max = Infinity, min = -Infinity } = meta;
			if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
			if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
		}
		Schema.extend("string", (data, { meta }, options) => {
			if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
			if (meta.pattern) {
				const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
				if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
			}
			checkWithinRange(data.length, meta, "string length", options);
			return [data];
		});
		function decimalShift(data, digits) {
			const str = data.toString();
			if (str.includes("e")) return data * Math.pow(10, digits);
			const index = str.indexOf(".");
			if (index === -1) return data * Math.pow(10, digits);
			const frac = str.slice(index + 1);
			const integer = str.slice(0, index);
			if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
			return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
		}
		function isMultipleOf(data, min, step) {
			step = Math.abs(step);
			if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
			const index = step.toString().indexOf(".");
			const digits = step.toString().slice(index + 1).length;
			return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
		}
		Schema.extend("number", (data, { meta }, options) => {
			if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
			checkWithinRange(data, meta, "number", options);
			const { step } = meta;
			if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
			return [data];
		});
		Schema.extend("boolean", (data, _, options) => {
			if (typeof data === "boolean") return [data];
			throw new ValidationError(`expected boolean but got ${data}`, options);
		});
		Schema.extend("bitset", (data, { bits, meta }, options) => {
			let value = 0, keys = [];
			if (typeof data === "number") {
				value = data;
				for (const key in bits) if (data & bits[key]) keys.push(key);
			} else if (Array.isArray(data)) {
				keys = data;
				for (const key of keys) {
					if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
					if (key in bits) value |= bits[key];
				}
			} else throw new ValidationError(`expected number or array but got ${data}`, options);
			if (value === meta.default) return [value];
			return [value, keys];
		});
		Schema.extend("function", (data, _, options) => {
			if (typeof data === "function") return [data];
			throw new ValidationError(`expected function but got ${data}`, options);
		});
		Schema.extend("is", (data, { constructor }, options) => {
			if (typeof constructor === "function") {
				if (data instanceof constructor) return [data];
				throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
			} else {
				if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
				let prototype = Object.getPrototypeOf(data);
				while (prototype) {
					if (prototype.constructor?.name === constructor) return [data];
					prototype = Object.getPrototypeOf(prototype);
				}
				throw new ValidationError(`expected ${constructor} but got ${data}`, options);
			}
		});
		function property(data, key, schema, options) {
			try {
				const [value, adapted] = Schema.resolve(data[key], schema, {
					...options,
					path: [...options.path || [], key]
				});
				if (adapted !== void 0) data[key] = adapted;
				return value;
			} catch (e) {
				if (!options?.autofix) throw e;
				delete data[key];
				return schema.meta.default;
			}
		}
		Schema.extend("array", (data, { inner, meta }, options) => {
			if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
			checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
			return [data.map((_, index) => property(data, index, inner, options))];
		});
		Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
			if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
			const result = {};
			for (const key in data) {
				let rKey;
				try {
					rKey = Schema.resolve(key, sKey, options)[0];
				} catch (error) {
					if (strict) continue;
					throw error;
				}
				result[rKey] = property(data, key, inner, options);
				data[rKey] = data[key];
				if (key !== rKey) delete data[key];
			}
			return [result];
		});
		Schema.extend("tuple", (data, { list }, options, strict) => {
			if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
			const result = list.map((inner, index) => property(data, index, inner, options));
			if (strict) return [result];
			result.push(...data.slice(list.length));
			return [result];
		});
		function merge(result, data) {
			for (const key in data) {
				if (key in result) continue;
				result[key] = data[key];
			}
		}
		Schema.extend("object", (data, { dict }, options, strict) => {
			if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
			const result = {};
			for (const key in dict) {
				const value = property(data, key, dict[key], options);
				if (!isNullable(value) || key in data) result[key] = value;
			}
			if (!strict) merge(result, data);
			return [result];
		});
		Schema.extend("union", (data, { list, toString }, options, strict) => {
			const messages = [];
			for (const inner of list) try {
				return Schema.resolve(data, inner, options, strict);
			} catch (error) {
				messages.push(error);
			}
			throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		});
		Schema.extend("intersect", (data, { list, toString }, options, strict) => {
			if (!list.length) return [data];
			let result;
			for (const inner of list) {
				const value = Schema.resolve(data, inner, options, true)[0];
				if (isNullable(value)) continue;
				if (isNullable(result)) result = value;
				else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
				else if (typeof value === "object") merge(result ??= {}, value);
				else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
			}
			if (!strict && isPlainObject(data)) merge(result, data);
			return [result];
		});
		Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
			const [result, adapted = data] = Schema.resolve(data, inner, options, true);
			if (preserve) return [callback(result)];
			else return [callback(result), callback(adapted)];
		});
		const formatters = {};
		function defineMethod(name, keys, format) {
			formatters[name] = format;
			Object.assign(Schema, { [name](...args) {
				const schema = new Schema({ type: name });
				keys.forEach((key, index) => {
					switch (key) {
						case "sKey":
							schema.sKey = args[index] ?? Schema.string();
							break;
						case "inner":
							schema.inner = Schema.from(args[index]);
							break;
						case "list":
							schema.list = args[index].map(Schema.from);
							break;
						case "dict":
							schema.dict = mapValues(args[index], Schema.from);
							break;
						case "bits":
							schema.bits = {};
							for (const key in args[index]) {
								if (typeof args[index][key] !== "number") continue;
								schema.bits[key] = args[index][key];
							}
							break;
						case "callback": {
							const callback = schema.callback = args[index];
							callback["toJSON"] ||= () => callback.toString();
							break;
						}
						case "constructor": {
							const constructor = schema.constructor = args[index];
							if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
							break;
						}
						default: schema[key] = args[index];
					}
				});
				if (name === "object" || name === "dict") schema.meta.default = {};
				else if (name === "array" || name === "tuple") schema.meta.default = [];
				else if (name === "bitset") schema.meta.default = 0;
				return schema;
			} });
		}
		defineMethod("is", ["constructor"], ({ constructor }) => {
			if (typeof constructor === "function") return constructor.name;
			else return constructor;
		});
		defineMethod("any", [], () => "any");
		defineMethod("never", [], () => "never");
		defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
		defineMethod("string", [], () => "string");
		defineMethod("number", [], () => "number");
		defineMethod("boolean", [], () => "boolean");
		defineMethod("bitset", ["bits"], () => "bitset");
		defineMethod("function", [], () => "function");
		defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
		defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
		defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
		defineMethod("object", ["dict"], ({ dict }) => {
			if (Object.keys(dict).length === 0) return "{}";
			return `{ ${Object.entries(dict).map(([key, inner]) => {
				return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
			}).join(", ")} }`;
		});
		defineMethod("union", ["list"], ({ list }, inline) => {
			const result = list.map(({ toString: format }) => format()).join(" | ");
			return inline ? `(${result})` : result;
		});
		defineMethod("intersect", ["list"], ({ list }) => {
			return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
		});
		defineMethod("transform", [
			"inner",
			"callback",
			"preserve"
		], ({ inner }, isInner) => inner.toString(isInner));
		//#endregion
		//#region src/settings.ts
		/** Durable speech preferences shared by the Host schema and the browser scope. */
		/** Settings namespace owned by the speech plugin. */
		const SPEECH_SETTINGS_NAMESPACE = "ui-speech";
		/** Field carrying the selected provider. */
		const PROVIDER_FIELD = "provider";
		/** Field carrying whether read-aloud skips code and tables. */
		const SKIP_CODE_FIELD = "skipCode";
		/** Field carrying the Microsoft Edge block. */
		const EDGE_FIELD = "edge";
		/**
		* Providers this build can speak through. The union grows with each provider
		* folder; a value outside it is refused by the schema rather than silently
		* falling back to another voice.
		*/
		const SPEECH_PROVIDERS = ["edge"];
		/** Provider used when the user-settings document has no override. */
		const DEFAULT_PROVIDER = "edge";
		/** Edge defaults: the service always serves voices, so this block is never empty. */
		const DEFAULT_EDGE_SETTINGS = Object.freeze({
			voice: "pt-BR-AntonioNeural",
			rate: 0,
			volume: 0,
			pitch: 0
		});
		Schema.object({
			[PROVIDER_FIELD]: Schema.union([...SPEECH_PROVIDERS]).default(DEFAULT_PROVIDER),
			[SKIP_CODE_FIELD]: Schema.boolean().default(true),
			[EDGE_FIELD]: Schema.object({
				voice: Schema.string().default(DEFAULT_EDGE_SETTINGS.voice),
				rate: Schema.number().step(1).min(-50).max(50).default(DEFAULT_EDGE_SETTINGS.rate),
				volume: Schema.number().step(1).min(-50).max(50).default(DEFAULT_EDGE_SETTINGS.volume),
				pitch: Schema.number().step(1).min(-50).max(50).default(DEFAULT_EDGE_SETTINGS.pitch)
			}).default(DEFAULT_EDGE_SETTINGS)
		});
		/** The complete section with every default filled in. */
		const DEFAULT_SPEECH_SETTINGS = Object.freeze({
			provider: DEFAULT_PROVIDER,
			skipCode: true,
			edge: DEFAULT_EDGE_SETTINGS
		});
		/**
		* Read the voice and tuning the active provider's block holds.
		* @param section - durable speech settings.
		* @returns the editable values of the selected provider.
		*/
		function activeVoiceSettings(section) {
			return section.edge;
		}
		/**
		* Name the settings field holding the active provider's block.
		* @returns the namespace field the selected provider's values live under.
		*/
		function activeBlockField() {
			return EDGE_FIELD;
		}
		//#endregion
		//#region src/speech-text.ts
		/**
		* Emoji and the code points that only exist to compose them: variation
		* selectors, joiners, skin-tone modifiers, and keycap marks.
		*/
		const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D\u20E3]/gu;
		/** Flag emoji are regional-indicator pairs with no pictographic property of their own. */
		const REGIONAL_INDICATORS = /[\u{1F1E6}-\u{1F1FF}]/gu;
		/** Fenced code blocks, with or without an info string. */
		const FENCE = /^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm;
		/** Inline code spans. */
		const INLINE_CODE = /`[^`\n]*`/g;
		/** HTML tags, including autolinks: both are markup, never speech. */
		const TAG = /<[^>\n]*>/g;
		/** Markdown images: neither the file target nor its alt text is speech. */
		const IMAGE = /!\[[^\]]*\]\([^)\s]*(?:\s+"[^"]*")?\)/g;
		/** Markdown and reference links: the label is speech, the target is not. */
		const LINK = /\[([^\]]*)\]\((?:[^)\s]*)(?:\s+"[^"]*")?\)/g;
		const REFERENCE_LINK = /\[([^\]]*)\]\[[^\]]*\]/g;
		/** Footnote and citation markers (`[1]`, `[^1]`). */
		const FOOTNOTE = /\[\^?\d+\]/g;
		/** Bare URLs the prose carries without link syntax. */
		const BARE_URL = /\b(?:https?:\/\/|www\.)\S+/gi;
		/** Line-leading Markdown markers: headings, quotes, and list bullets. */
		const LINE_MARKER = /^[ \t]*(?:#{1,6}|>|[-*+]|\d+[.)])[ \t]+/gm;
		/** Table rows and their separator lines. */
		const TABLE_ROW = /^[ \t]*\|.*\|[ \t]*$/gm;
		const TABLE_SEPARATOR = /^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/gm;
		/**
		* Pasted spreadsheet rows. A line carrying three or more tab stops is a range
		* copy, not prose, and reading it aloud is noise.
		*/
		const SHEET_ROW = /^.*\t.*\t.*\t.*$/gm;
		/**
		* Quotation marks of both families. A voice never speaks them, and the
		* phonemizer turns some of them into stray phonemes.
		*/
		const QUOTES = /["'«»“”‘’]/g;
		/**
		* Emphasis markers that wrap a word. The lookarounds leave an operator between
		* two characters alone, so `2*3` still reaches the normalizer's math rule, and
		* a closing run may be followed by the sentence's punctuation.
		*/
		const EMPHASIS = /(?<=^|\s)[*_~]{1,3}(?=\S)|(?<=\S)[*_~]{1,3}(?=$|\s|[.,;:!?)\]])/gm;
		/** Whether one token carries a letter or a digit, and so has something to say. */
		const SPEAKABLE = /[\p{L}\p{N}]/u;
		/** Leftover bracket pairs whose content was dropped. */
		const EMPTY_PAIR = /\(\s*\)|\[\s*\]|\{\s*\}/g;
		/**
		* Project Markdown onto the text a voice reads.
		* @param markdown - assistant message source.
		* @param options - whether code is dropped instead of read.
		* @returns whitespace-normalized spoken text, empty when nothing is speakable.
		*/
		function speechText(markdown, options) {
			let text = markdown.replace(/\r\n?/g, "\n");
			if (options.skipCode) text = text.replace(FENCE, "\n").replace(INLINE_CODE, " ");
			else text = text.replace(FENCE, (block) => block.replace(/^```[^\n]*\n?|^```[^\n]*$/gm, "\n")).replace(INLINE_CODE, (span) => span.slice(1, -1));
			text = text.replace(TABLE_ROW, "\n").replace(TABLE_SEPARATOR, "\n").replace(SHEET_ROW, "\n").replace(TAG, " ").replace(IMAGE, " ").replace(LINK, "$1").replace(REFERENCE_LINK, "$1").replace(FOOTNOTE, " ").replace(BARE_URL, " ").replace(LINE_MARKER, "").replace(EMPHASIS, "").replace(EMOJI, "").replace(REGIONAL_INDICATORS, "").replace(QUOTES, "");
			return text.split("\n").map((line) => line.split(/\s+/).filter((word) => SPEAKABLE.test(word)).join(" ")).filter((line) => line !== "").join("\n").replace(EMPTY_PAIR, " ").trim();
		}
		//#endregion
		//#region src/client/controller.ts
		/**
		* Read the detail behind a caught failure.
		* @param error - the thrown value.
		* @returns its message.
		*/
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/** Owns read-aloud state transitions over one playback engine. */
		var SpeechController = class {
			state;
			audio;
			report;
			/**
			* @param state - the shared state source every action reads.
			* @param audio - playback over the host's synthesis route.
			* @param report - receives failure detail (the surface shows the code's copy).
			*/
			constructor(state, audio, report) {
				this.state = state;
				this.audio = audio;
				this.report = report;
			}
			/**
			* Fold one finalized assistant message's prose.
			* @param messageId - the message the prose belongs to.
			* @param source - the message's raw text blocks, before projection.
			*/
			record(messageId, source) {
				const snapshot = this.state.getSnapshot();
				if (snapshot.sources.get(messageId) === source) return;
				const sources = new Map(snapshot.sources);
				sources.set(messageId, source);
				this.state.set({
					...snapshot,
					sources
				});
			}
			/**
			* Speak one message, replacing whatever is playing. A request superseded by a
			* newer one starts nothing.
			* @param messageId - message whose audio is requested.
			* @param options - projection options in effect for this reading.
			* @param overrides - preview overrides when the settings screen asks for them.
			*/
			async speak(messageId, options, overrides) {
				const source = this.state.getSnapshot().sources.get(messageId);
				const text = source === void 0 ? "" : speechText(source, options);
				if (text === "") {
					this.publish({
						active: messageId,
						failure: "unavailable",
						detail: null
					});
					return;
				}
				this.publish({
					active: messageId,
					failure: null,
					detail: null
				});
				try {
					await this.audio.speak(text, overrides, () => {
						if (this.state.getSnapshot().active === messageId) this.publish({ active: null });
					});
				} catch (error) {
					const detail = messageOf(error);
					this.report(detail);
					this.publish({
						active: messageId,
						failure: "provider",
						detail
					});
				}
			}
			/**
			* Speak one ad-hoc sample for the settings row's test button, through the
			* settings currently on screen rather than the durable ones.
			* @param text - sample to speak.
			* @param overrides - provider, voice, and tuning to preview.
			*/
			async speakSample(text, overrides) {
				const sample = text.trim();
				if (sample === "") return;
				this.audio.stop();
				try {
					await this.audio.speak(sample, overrides, () => {});
				} catch (error) {
					this.report(messageOf(error));
				}
			}
			/** Stop the current playback and clear the active message. */
			stop() {
				this.audio.stop();
				if (this.state.getSnapshot().active !== null) this.publish({ active: null });
			}
			/** Release playback with the owning plugin. */
			dispose() {
				this.audio.dispose();
				this.publish({ active: null });
			}
			publish(next) {
				this.state.set({
					...this.state.getSnapshot(),
					...next
				});
			}
		};
		//#endregion
		//#region src/client/locales.ts
		/** `speech` namespace dictionaries: the read-aloud action and its settings row. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"speak.read": "朗读这条回复",
			"speak.stop": "停止朗读",
			"speak.failed.unavailable": "这条回复暂时无法朗读",
			"speak.failed.provider": "语音服务调用失败",
			"row.title": "朗读",
			"row.description": "用于朗读助手回复的语音",
			"row.provider": "服务",
			"row.language": "语言",
			"row.voice": "声音",
			"row.rate": "速度",
			"row.volume": "音量",
			"row.pitch": "音高",
			"row.percentUnit": "%",
			"row.pitchUnit": "Hz",
			"row.skipCode": "跳过代码",
			"row.skipCode.description": "朗读时忽略代码块与表格",
			"row.test": "试听",
			"row.testSample": "这就是我朗读回复的声音。",
			"row.writeFailed": "未保存——仍在使用之前的值。",
			"provider.edge": "Microsoft Edge"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"speak.read": "Read this reply aloud",
			"speak.stop": "Stop reading aloud",
			"speak.failed.unavailable": "This reply has no spoken text",
			"speak.failed.provider": "The speech service call failed",
			"row.title": "Read aloud",
			"row.description": "The voice used to read assistant replies",
			"row.provider": "Service",
			"row.language": "Language",
			"row.voice": "Voice",
			"row.rate": "Speed",
			"row.volume": "Volume",
			"row.pitch": "Pitch",
			"row.percentUnit": "%",
			"row.pitchUnit": "Hz",
			"row.skipCode": "Skip code",
			"row.skipCode.description": "Leave code blocks and tables out of the reading",
			"row.test": "Test voice",
			"row.testSample": "This is how I read your replies.",
			"row.writeFailed": "Not saved — the previous value is still in effect.",
			"provider.edge": "Microsoft Edge"
		};
		//#endregion
		//#region src/client/nodes.ts
		/** Definition kind, unique among the composed definitions. */
		const KIND = "speech-text";
		/**
		* Join the spoken source of one finalized assistant message: its text blocks, in
		* order, with paragraph breaks between them.
		* @param event - the finalized assistant message event.
		* @returns the message's prose.
		*/
		function assistantSource(event) {
			return event.data.message.content.flatMap((block) => block.type === "text" ? [block.text] : []).join("\n\n");
		}
		/**
		* Register the spoken-text fold.
		* @param ctx - client context carrying the conversation registries.
		* @param controller - receives every folded message's raw prose.
		*/
		function registerSpeechText(ctx, controller) {
			const definition = {
				kind: KIND,
				match(event) {
					if (event.type !== "assistant/message") return null;
					return {
						id: event.data.message.id,
						role: "start"
					};
				},
				start(_context, match) {
					const { event } = match;
					if (event.type !== "assistant/message") throw new Error("speech-text start requires assistant/message");
					controller.record(event.data.message.id, assistantSource(event));
					return { messageId: event.data.message.id };
				},
				update(context, match) {
					if (match.event.type === "assistant/message") controller.record(match.event.data.message.id, assistantSource(match.event));
					return context.state;
				}
			};
			ctx.effect(() => ctx.uiConversation.events.register(definition), "ui-speech: assistant spoken text");
		}
		//#endregion
		//#region src/client/settings-store.ts
		/**
		* Speech settings row store: a mirror of the durable section plus the voice
		* catalog and the settlement of the last write this row asked for. The plugin's
		* apply-world listener is the only writer; the row reads via props.useStore.
		*/
		/**
		* Declares the speech row state and write surface.
		* @returns the store handle.
		*/
		function createSpeechRowStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({
					provider: DEFAULT_PROVIDER,
					voice: DEFAULT_EDGE_SETTINGS.voice,
					rate: DEFAULT_EDGE_SETTINGS.rate,
					volume: DEFAULT_EDGE_SETTINGS.volume,
					pitch: DEFAULT_EDGE_SETTINGS.pitch,
					skipCode: true,
					voices: [],
					language: "",
					revision: -1,
					writeFailed: false
				}),
				actions: {
					sync: (d, section, revision) => {
						if (revision <= d.revision) return;
						d.provider = section.provider;
						d.voice = section.voice;
						d.rate = section.rate;
						d.volume = section.volume;
						d.pitch = section.pitch;
						d.skipCode = section.skipCode;
						d.revision = revision;
					},
					setVoices: (d, voices) => {
						d.voices = voices;
						const selected = voices.find((voice) => voice.id === d.voice);
						if (selected !== void 0) {
							d.language = selected.language;
							return;
						}
						if (!voices.some((voice) => voice.language === d.language)) d.language = voices[0]?.language ?? "";
					},
					setLanguage: (d, language) => {
						d.language = language;
					},
					markWriteFailed: (d, failed) => {
						d.writeFailed = failed;
					}
				}
			});
		}
		//#endregion
		//#region src/client/sentences.ts
		/**
		* Text chunking for read-aloud. A reply is normally sent as one request, so the
		* provider can stream audio while it works through the text; chunking only
		* applies to a reply larger than one request may carry, and to the fallback
		* path used when the browser cannot stream encoded audio.
		*/
		/** Chunk size used when streaming is unavailable: one sentence per request. */
		const SENTENCE_CHARS = 400;
		/** Break points preferred inside an over-long span, longest pause first. */
		const SOFT_BREAKS = [
			". ",
			"! ",
			"? ",
			"; ",
			": ",
			", ",
			" "
		];
		/**
		* Split one text into sentence-sized spans.
		* @param text - projected spoken text.
		* @param limit - longest span to emit; a host that refuses a larger request reports its own bound.
		* @returns speakable spans, never empty strings.
		*/
		function splitSentences(text, limit = SENTENCE_CHARS) {
			const spans = [];
			for (const line of text.split("\n")) {
				const trimmed = line.trim();
				if (trimmed === "") continue;
				for (const sentence of trimmed.split(/(?<=[.!?…])\s+/)) spans.push(...bounded(sentence, limit));
			}
			return spans;
		}
		/**
		* Pack one text into requests: a single span when it fits, otherwise several
		* spans cut on sentence ends.
		* @param text - projected spoken text.
		* @returns one or more speakable requests, never empty strings.
		*/
		function splitRequests(text) {
			const trimmed = text.trim();
			if (trimmed === "") return [];
			if (trimmed.length <= 2e4) return [trimmed];
			const packed = [];
			let current = "";
			for (const sentence of splitSentences(trimmed)) {
				if (current !== "" && current.length + sentence.length + 1 > 2e4) {
					packed.push(current);
					current = "";
				}
				current = current === "" ? sentence : `${current} ${sentence}`;
			}
			packed.push(current);
			return packed;
		}
		/**
		* Cut one span down to a bound, preferring a soft break so the voice pauses
		* where the prose does.
		* @param text - one span, possibly longer than the bound.
		* @param limit - longest span to emit.
		* @returns one or more spans within the bound.
		*/
		function bounded(text, limit) {
			if (text.length <= limit) return [text];
			const pieces = [];
			let rest = text;
			while (rest.length > limit) {
				const window = rest.slice(0, limit);
				let cut = -1;
				for (const breakPoint of SOFT_BREAKS) {
					const at = window.lastIndexOf(breakPoint);
					if (at > cut) cut = at + breakPoint.length - 1;
				}
				const end = cut > 0 ? cut : limit;
				pieces.push(rest.slice(0, end).trim());
				rest = rest.slice(end).trim();
			}
			pieces.push(rest);
			return pieces;
		}
		//#endregion
		//#region src/client/speech-audio.ts
		/**
		* Browser playback over the host's synthesis route.
		*
		* The whole reply goes out in one request and the audio is played as it
		* arrives: the response body is read chunk by chunk and appended to a
		* MediaSource buffer the audio element already plays from, so speech starts on
		* the first frames and never waits for the rest — the audio equivalent of
		* watching an answer stream in.
		*
		* A browser whose MediaSource cannot take MP3 falls back to one request per
		* sentence and blob playback, which still works but waits for each sentence.
		*/
		/** Route the host exposes for synthesis. */
		const SPEAK_ROUTE = "/speech/speak";
		/** Content type the host answers with, and the one MediaSource must accept. */
		const AUDIO_TYPE = "audio/mpeg";
		/**
		* Whether this browser can play encoded audio as it streams in.
		* @returns true when MediaSource accepts the host's audio type.
		*/
		function streamsAudio() {
			return typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(AUDIO_TYPE);
		}
		/**
		* Read the error a failed synthesis answered with.
		* @param response - the failed response.
		* @returns the host's message, or the status line.
		*/
		async function failureOf(response) {
			try {
				const body = await response.json();
				if (typeof body.error === "string") return body.error;
			} catch (_notJson) {}
			return `${response.status} ${response.statusText}`;
		}
		/**
		* Read the request bound a refusal named.
		* @param message - the host's error text.
		* @returns the character limit, or undefined when the refusal was about something else.
		*/
		function limitOf(message) {
			const match = /1\.\.(\d+) characters/.exec(message);
			if (match === null) return void 0;
			const limit = Number.parseInt(match[1], 10);
			return Number.isFinite(limit) && limit > 0 ? limit : void 0;
		}
		/**
		* Resolve once a buffer is ready to accept appends.
		* @param media - the MediaSource the audio element plays from.
		* @returns the source buffer, in sequence mode.
		*/
		function openBuffer(media) {
			return new Promise((resolve, reject) => {
				media.addEventListener("sourceopen", () => {
					try {
						const buffer = media.addSourceBuffer(AUDIO_TYPE);
						buffer.mode = "sequence";
						resolve(buffer);
					} catch (error) {
						reject(error instanceof Error ? error : new Error(String(error)));
					}
				}, { once: true });
			});
		}
		/**
		* Append one chunk and wait for the buffer to accept it.
		* @param buffer - the source buffer.
		* @param chunk - encoded audio bytes.
		*/
		async function appendChunk(buffer, chunk) {
			const settled = new Promise((resolve) => {
				buffer.addEventListener("updateend", () => {
					resolve();
				}, { once: true });
			});
			buffer.appendBuffer(new Uint8Array(chunk));
			await settled;
		}
		/**
		* Resolve when an element stops producing sound, whether it ended or failed.
		* @param element - the audio element.
		*/
		function finished(element) {
			if (element.ended) return Promise.resolve();
			return new Promise((resolve) => {
				element.addEventListener("ended", () => {
					resolve();
				}, { once: true });
				element.addEventListener("error", () => {
					resolve();
				}, { once: true });
			});
		}
		/** Owns the audio currently playing and the requests behind it. */
		var SpeechAudio = class {
			/** Cancellation token: every stop or new request invalidates what is running. */
			generation = 0;
			playing;
			objectUrl;
			/**
			* Speak one text. The whole reply travels in one request whenever it fits, and
			* playback starts on the first audio frames that arrive.
			* @param text - projected spoken text.
			* @param overrides - preview overrides, or undefined to use the durable settings.
			* @param onEnded - called once the last audio has played out.
			*/
			async speak(text, overrides, onEnded) {
				const requests = splitRequests(text);
				if (requests.length === 0) return;
				const generation = ++this.generation;
				this.dropPlayback();
				const single = requests.length === 1 ? requests[0] : void 0;
				const played = single !== void 0 && streamsAudio() ? await this.streamRequest(single, overrides, generation) : await this.playSentenceBySentence(splitSentences(text), overrides, generation);
				this.report(played, onEnded);
			}
			/**
			* Report an end for a run that played out, and stay silent for one that a
			* later stop or speak superseded.
			* @param played - whether the run reached its last audio frame.
			* @param onEnded - the caller's end callback.
			*/
			report(played, onEnded) {
				if (played) onEnded();
			}
			/** Stop playback and abandon whatever is still arriving. */
			stop() {
				this.generation += 1;
				this.dropPlayback();
			}
			/** Stop playback and release the last object URL. */
			dispose() {
				this.stop();
			}
			/**
			* Stream one request's audio into a MediaSource-backed element.
			* @param text - the whole projected text.
			* @param overrides - preview overrides, when any.
			* @param generation - token this request belongs to.
			* @returns whether playback ran to the end under the same generation.
			*/
			async streamRequest(text, overrides, generation) {
				const response = await fetch(SPEAK_ROUTE, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						text,
						...overrides
					})
				});
				if (!response.ok) {
					const message = await failureOf(response);
					const limit = limitOf(message);
					if (limit === void 0) throw new Error(message);
					return await this.playSentenceBySentence(splitSentences(text, limit), overrides, generation);
				}
				const body = response.body;
				if (body === null) throw new Error("speech stream carried no body");
				const media = new MediaSource();
				const url = URL.createObjectURL(media);
				const element = new Audio(url);
				this.playing = element;
				this.objectUrl = url;
				const buffer = await openBuffer(media);
				const reader = body.getReader();
				let started = false;
				try {
					for (;;) {
						const { done, value } = await reader.read();
						if (generation !== this.generation) {
							await reader.cancel();
							return false;
						}
						if (value !== void 0 && value.length > 0) {
							await appendChunk(buffer, value);
							if (!started) {
								started = true;
								await element.play();
							}
						}
						if (done) break;
					}
				} finally {
					if (generation !== this.generation) this.releaseChunk(url);
				}
				if (!started) return false;
				if (media.readyState === "open") media.endOfStream();
				await finished(element);
				this.releaseChunk(url);
				return generation === this.generation;
			}
			/**
			* Fallback path for a reply the browser cannot stream: one request per
			* sentence, each played as a blob.
			* @param sentences - sentence-sized spans.
			* @param overrides - preview overrides, when any.
			* @param generation - token this run belongs to.
			* @returns whether every span played out under the same generation.
			*/
			async playSentenceBySentence(sentences, overrides, generation) {
				let pending;
				for (const [index, sentence] of sentences.entries()) {
					pending ??= this.fetchAudio(sentence, overrides);
					const audio = await pending;
					pending = void 0;
					if (generation !== this.generation) return false;
					const next = sentences[index + 1];
					if (next !== void 0) {
						pending = this.fetchAudio(next, overrides);
						pending.catch(() => {});
					}
					if (!await this.playBlob(audio, generation)) return false;
				}
				return true;
			}
			/**
			* Fetch the audio of one span.
			* @param text - span to speak.
			* @param overrides - preview overrides, when any.
			* @returns the encoded audio the host answered with.
			*/
			async fetchAudio(text, overrides) {
				const response = await fetch(SPEAK_ROUTE, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						text,
						...overrides
					})
				});
				if (!response.ok) throw new Error(await failureOf(response));
				return await response.blob();
			}
			/**
			* Play one buffered span and wait for it to finish.
			* @param audio - encoded audio bytes.
			* @param generation - token this span belongs to.
			* @returns whether the span played out under the same generation.
			*/
			async playBlob(audio, generation) {
				const url = URL.createObjectURL(audio);
				const element = new Audio(url);
				this.playing = element;
				this.objectUrl = url;
				element.addEventListener("ended", () => {}, { once: true });
				try {
					await element.play();
				} catch (error) {
					this.releaseChunk(url);
					throw error;
				}
				await finished(element);
				this.releaseChunk(url);
				return generation === this.generation;
			}
			dropPlayback() {
				const element = this.playing;
				const url = this.objectUrl;
				this.playing = void 0;
				this.objectUrl = void 0;
				element?.pause();
				if (url !== void 0) URL.revokeObjectURL(url);
			}
			releaseChunk(url) {
				if (this.objectUrl !== url) return;
				this.playing = void 0;
				this.objectUrl = void 0;
				URL.revokeObjectURL(url);
			}
		};
		//#endregion
		//#region src/client/speech-state.ts
		/**
		* Browser state every read-aloud action renders from: the message currently
		* being spoken, the failure the last attempt hit, and the spoken prose folded
		* from the session log. One source per plugin, shared by every session's action
		* strip.
		*/
		/**
		* Create the shared speech state source.
		* @returns an empty, unspeaking state.
		*/
		function createSpeechState() {
			return (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				active: null,
				failure: null,
				detail: null,
				sources: /* @__PURE__ */ new Map()
			});
		}
		//#endregion
		//#region \0dsh-css:E:\deepseek-harness\packages\client\ui-speech\src\client\SpeakAction.module.css.mjs
		const css$2 = ".ZOFdkq_wrap{align-items:center;gap:4px;display:inline-flex}.ZOFdkq_action{width:calc(28px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:8px;justify-content:center;align-items:center;padding:0;display:inline-flex}.ZOFdkq_action:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.ZOFdkq_action:disabled{color:var(--dsw-alias-label-caption);cursor:default}.ZOFdkq_action svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px))}.ZOFdkq_failure{font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));color:var(--dsw-alias-state-error-primary)}";
		const tagId$2 = "@nakamuraia/dsh-plugin-speech/SpeakAction.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@nakamuraia/dsh-plugin-speech";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var SpeakAction_module_css_default = {
			"action": "ZOFdkq_action",
			"failure": "ZOFdkq_failure",
			"wrap": "ZOFdkq_wrap"
		};
		//#endregion
		//#region src/client/SpeakAction.tsx
		/**
		* Read-aloud action for one finalized assistant message: a play/stop control in
		* the message's action strip, with the failure it hit shown beside it.
		*/
		/** Failure copy per code, so the rendered key stays a literal for the locale seat. */
		const FAILURE_KEYS = {
			unavailable: "speak.failed.unavailable",
			provider: "speak.failed.provider"
		};
		/**
		* Render the read-aloud action.
		* @param props - composed slot props.
		* @returns the action element tree.
		*/
		function SpeakAction({ messageId, t, useSpeech, toggle }) {
			const active = useSpeech((s) => s.active);
			const failure = useSpeech((s) => s.failure);
			const detail = useSpeech((s) => s.detail);
			const known = useSpeech((s) => s.sources.has(messageId));
			const mine = active === messageId;
			const failed = mine && failure !== null;
			const speaking = mine && !failed;
			const label = speaking ? t("speak.stop") : t("speak.read");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: SpeakAction_module_css_default.wrap,
				children: [failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: SpeakAction_module_css_default.failure,
					role: "status",
					title: detail ?? void 0,
					children: t(FAILURE_KEYS[failure])
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: SpeakAction_module_css_default.action,
					"aria-label": label,
					title: label,
					disabled: !known && !mine,
					onClick: () => {
						toggle(String(messageId));
					},
					children: speaking ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconStopFill16, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlayOutline16, {})
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:E:\deepseek-harness\packages\client\ui-speech\src\client\Slider.module.css.mjs
		const css$1 = ".LXNwLq_row{color:var(--dsw-alias-label-secondary);align-items:center;gap:8px;font-size:13px;line-height:20px;display:flex}.LXNwLq_label{flex:0 0 88px}.LXNwLq_range{appearance:none;cursor:pointer;background:0 0;flex:1;min-width:0;height:20px;margin:0}.LXNwLq_range::-webkit-slider-runnable-track{background:var(--dsw-alias-border-l2);border-radius:2px;height:4px}.LXNwLq_range::-webkit-slider-thumb{appearance:none;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-module-platform);border-radius:50%;width:14px;height:14px;margin-top:-5px}.LXNwLq_range::-moz-range-track{background:var(--dsw-alias-border-l2);border-radius:2px;height:4px}.LXNwLq_range::-moz-range-thumb{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-module-platform);border-radius:50%;width:14px;height:14px}.LXNwLq_value{text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);flex:0 0 44px}";
		const tagId$1 = "@nakamuraia/dsh-plugin-speech/Slider.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@nakamuraia/dsh-plugin-speech";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var Slider_module_css_default = {
			"label": "LXNwLq_label",
			"range": "LXNwLq_range",
			"row": "LXNwLq_row",
			"value": "LXNwLq_value"
		};
		//#endregion
		//#region src/client/Slider.tsx
		/**
		* A labelled range control. The shared primitive catalog has no slider, so this
		* package owns one; it stays a native `input[type=range]` so keyboard, touch,
		* and assistive technology keep working without being reimplemented.
		*/
		/**
		* Render one labelled range control.
		* @param props - control props.
		* @returns the control element.
		*/
		function Slider({ label, value, min, max, display, onChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: Slider_module_css_default.row,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: Slider_module_css_default.label,
						children: label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: Slider_module_css_default.range,
						type: "range",
						min,
						max,
						value,
						"aria-label": label,
						onChange: (event) => {
							onChange(Number(event.currentTarget.value));
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: Slider_module_css_default.value,
						children: display
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:E:\deepseek-harness\packages\client\ui-speech\src\client\SpeechRow.module.css.mjs
		const css = ".ExQEqW_group{border-bottom:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:8px;padding:16px 0;display:flex}.ExQEqW_rowText{flex-direction:column;gap:4px;padding-right:48px;display:flex}.ExQEqW_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.ExQEqW_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}.ExQEqW_failure{color:var(--dsw-alias-state-error-primary);font-size:12px;font-weight:400;line-height:18px}.ExQEqW_field{flex-direction:column;gap:4px;display:flex}.ExQEqW_fieldLabel{color:var(--dsw-alias-label-secondary);font-size:13px;font-weight:400;line-height:20px}.ExQEqW_selector{border:.5px solid var(--dsw-alias-border-l4);max-width:100%;min-height:32px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border-radius:16px;justify-content:space-between;align-items:center;gap:8px;padding:4px 12px;font-size:13px;line-height:20px;display:inline-flex}.ExQEqW_selector:hover{background:var(--dsw-alias-interactive-bg-hover)}.ExQEqW_selectorText{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.ExQEqW_chevron{color:var(--dsw-alias-label-secondary);flex:none}.ExQEqW_fieldRow{align-items:center;gap:8px;padding-top:4px;display:flex}.ExQEqW_fieldText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.ExQEqW_testRow{padding-top:4px}.ExQEqW_sample{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}";
		const tagId = "@nakamuraia/dsh-plugin-speech/SpeechRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@nakamuraia/dsh-plugin-speech";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SpeechRow_module_css_default = {
			"chevron": "ExQEqW_chevron",
			"desc": "ExQEqW_desc",
			"failure": "ExQEqW_failure",
			"field": "ExQEqW_field",
			"fieldLabel": "ExQEqW_fieldLabel",
			"fieldRow": "ExQEqW_fieldRow",
			"fieldText": "ExQEqW_fieldText",
			"group": "ExQEqW_group",
			"rowText": "ExQEqW_rowText",
			"sample": "ExQEqW_sample",
			"selector": "ExQEqW_selector",
			"selectorText": "ExQEqW_selectorText",
			"testRow": "ExQEqW_testRow",
			"title": "ExQEqW_title"
		};
		//#endregion
		//#region src/client/SpeechRow.tsx
		/**
		* Read-aloud settings row registered into the General section item slot: the
		* service, the voice (language first, then the voices that language offers), the
		* three tuning sliders, the skip-code switch, and a test button that speaks the
		* settings currently on screen — saved or not.
		*/
		/** Tuning bounds, matching the durable schema. */
		const TUNING_MIN = -50;
		const TUNING_MAX = 50;
		/** Signed unit value, in whatever unit the locale names for this control. */
		function signed(value, unit) {
			return `${value > 0 ? "+" : ""}${value}${unit}`;
		}
		/** One labelled dropdown: a pill that opens a menu of string options. */
		function Picker({ label, options, selected, onSelect }) {
			const [open, setOpen] = (0, react.useState)(false);
			const active = options.find((option) => option.id === selected)?.label ?? selected;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SpeechRow_module_css_default.field,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: SpeechRow_module_css_default.fieldLabel,
					children: label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
					open,
					onClose: () => {
						setOpen(false);
					},
					items: options,
					selectedId: selected,
					onSelect: (id) => {
						onSelect(id);
						setOpen(false);
					},
					align: "start",
					portal: true,
					anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: SpeechRow_module_css_default.selector,
						"aria-haspopup": "menu",
						"aria-expanded": open,
						onClick: () => {
							setOpen((current) => !current);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SpeechRow_module_css_default.selectorText,
							children: active
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: SpeechRow_module_css_default.chevron })]
					})
				})]
			});
		}
		/**
		* Render the read-aloud settings row.
		* @param props - composed slot props.
		* @returns the row element tree.
		*/
		function SpeechRow({ t, useStore, setProvider, setVoice, setTuning, setSkipCode, test }) {
			const provider = useStore((s) => s.provider);
			const voice = useStore((s) => s.voice);
			const rate = useStore((s) => s.rate);
			const volume = useStore((s) => s.volume);
			const pitch = useStore((s) => s.pitch);
			const skipCode = useStore((s) => s.skipCode);
			const voices = useStore((s) => s.voices);
			const language = useStore((s) => s.language);
			const writeFailed = useStore((s) => s.writeFailed);
			const languages = [...new Set(voices.map((entry) => entry.language))].sort();
			const offered = voices.filter((entry) => entry.language === language);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SpeechRow_module_css_default.group,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SpeechRow_module_css_default.rowText,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: SpeechRow_module_css_default.title,
								children: t("row.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: SpeechRow_module_css_default.desc,
								children: t("row.description")
							}),
							writeFailed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: SpeechRow_module_css_default.failure,
								role: "status",
								children: t("row.writeFailed")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Picker, {
						label: t("row.provider"),
						options: SPEECH_PROVIDERS.map((id) => ({
							id,
							label: t(`provider.${id}`)
						})),
						selected: provider,
						onSelect: (id) => {
							setProvider(id);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Picker, {
						label: t("row.language"),
						options: languages.map((tag) => ({
							id: tag,
							label: tag
						})),
						selected: language,
						onSelect: (id) => {
							setVoice(firstVoiceOf(voices, id));
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Picker, {
						label: t("row.voice"),
						options: offered.map((entry) => ({
							id: entry.id,
							label: entry.name
						})),
						selected: voice,
						onSelect: setVoice
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Slider, {
						label: t("row.rate"),
						value: rate,
						min: TUNING_MIN,
						max: TUNING_MAX,
						display: signed(rate, t("row.percentUnit")),
						onChange: (value) => {
							setTuning("rate", value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Slider, {
						label: t("row.volume"),
						value: volume,
						min: TUNING_MIN,
						max: TUNING_MAX,
						display: signed(volume, t("row.percentUnit")),
						onChange: (value) => {
							setTuning("volume", value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Slider, {
						label: t("row.pitch"),
						value: pitch,
						min: TUNING_MIN,
						max: TUNING_MAX,
						display: signed(pitch, t("row.pitchUnit")),
						onChange: (value) => {
							setTuning("pitch", value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SpeechRow_module_css_default.fieldRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SpeechRow_module_css_default.fieldText,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: SpeechRow_module_css_default.fieldLabel,
								children: t("row.skipCode")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: SpeechRow_module_css_default.desc,
								children: t("row.skipCode.description")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
							checked: skipCode,
							label: t("row.skipCode"),
							onChange: setSkipCode
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SpeechRow_module_css_default.testRow,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								test(t("row.testSample"), {
									provider,
									voice,
									tuning: {
										rate,
										volume,
										pitch
									}
								});
							},
							children: t("row.test")
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SpeechRow_module_css_default.sample,
						children: t("row.testSample")
					})
				]
			});
		}
		/**
		* Pick the voice one language selection lands on: its first listed voice, or the
		* current selection when that selection already belongs to the language.
		* @param voices - full catalog.
		* @param language - language the user selected.
		* @returns the voice id to select.
		*/
		function firstVoiceOf(voices, language) {
			/* v8 ignore next -- every language offered came from this catalog, so a lookup for one always finds a voice */
			return voices.find((entry) => entry.language === language)?.id ?? "";
		}
		//#endregion
		//#region src/client/index.ts
		/** Namespace owning this feature's copy. */
		const SETTINGS_NS = "speech";
		/** Required services: the surfaces' registries and the settings transport. */
		const inject = [
			"slots",
			"locale",
			"uiConversation",
			"remote",
			"settingsScope"
		];
		/** Route the host answers the voice catalog on. */
		const VOICES_ROUTE = "/speech/voices";
		/**
		* Flatten the durable section into the values the settings row displays.
		* @param section - durable speech settings.
		* @returns the active provider's editable values.
		*/
		function rowSectionOf(section) {
			const active = activeVoiceSettings(section);
			return {
				provider: section.provider,
				voice: active.voice,
				rate: active.rate,
				volume: active.volume,
				pitch: active.pitch,
				skipCode: section.skipCode
			};
		}
		/**
		* Client plugin body.
		* @param ctx - client cordis context.
		*/
		function apply(ctx) {
			const state = createSpeechState();
			const controller = new SpeechController(state, new SpeechAudio(), (message) => {
				ctx.logger.warn(message);
			});
			ctx.effect(() => () => {
				controller.dispose();
			}, "ui-speech: playback teardown");
			registerSpeechText(ctx, controller);
			ctx.effect(() => ctx.locale.register(SETTINGS_NS, {
				zh,
				en
			}), "ui-speech: dictionaries");
			const host = ctx.settingsScope.bind({ namespace: SPEECH_SETTINGS_NAMESPACE });
			const section = () => host.getSnapshot().value ?? DEFAULT_SPEECH_SETTINGS;
			const projection = () => ({ skipCode: section().skipCode });
			const store = createSpeechRowStore();
			let bound;
			const sync = () => {
				bound?.sync(rowSectionOf(section()), host.getSnapshot().revision ?? 0);
			};
			ctx.effect(() => host.subscribe(sync), "ui-speech: settings mirror");
			/**
			* Load the selected provider's voice catalog. A provider that publishes none
			* (its voices belong to the user's account) simply leaves the list empty.
			* @param provider - provider whose catalog is requested.
			*/
			const refreshVoices = (provider) => {
				fetch(`${VOICES_ROUTE}?provider=${encodeURIComponent(provider)}`).then(async (response) => {
					if (!response.ok) return [];
					return (await response.json()).voices ?? [];
				}).then((voices) => {
					bound?.setVoices(voices);
				}).catch((error) => {
					ctx.logger.warn(error instanceof Error ? error.message : String(error));
				});
			};
			const toggle = (messageId) => {
				const snapshot = state.getSnapshot();
				if (snapshot.active === messageId && snapshot.failure === null) {
					controller.stop();
					return;
				}
				controller.speak(messageId, projection());
			};
			ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
				name: "conversation.chat.assistant-actions",
				id: "speech",
				order: 20,
				locale: SETTINGS_NS,
				inject: () => ({
					hooks: { speech: state },
					toggle
				})
			}, SpeakAction));
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "speech",
				order: 13,
				store,
				locale: SETTINGS_NS,
				inject: (actions) => {
					bound = actions;
					sync();
					refreshVoices(section().provider);
					const settle = (written, holds) => {
						if (host.getSnapshot().mode === "memory") return;
						written.then(() => {
							actions.markWriteFailed(!holds());
						}, () => {
							actions.markWriteFailed(true);
						});
					};
					const writeField = (field, value, holds) => {
						settle(host.set(field, value), holds);
					};
					const writeEntry = (entryField, key, value, holds) => {
						settle(host.mutate([{
							op: "set",
							path: [entryField, key],
							value
						}]), holds);
					};
					return {
						setProvider: (provider) => {
							const requested = provider;
							writeField(PROVIDER_FIELD, provider, () => section().provider === requested);
							refreshVoices(provider);
						},
						setVoice: (voice) => {
							writeEntry(activeBlockField(), "voice", voice, () => activeVoiceSettings(section()).voice === voice);
						},
						setTuning: (key, value) => {
							writeEntry(activeBlockField(), key, value, () => activeVoiceSettings(section())[key] === value);
						},
						setSkipCode: (skipCode) => {
							writeField(SKIP_CODE_FIELD, skipCode, () => section().skipCode === skipCode);
						},
						test: (text, overrides) => {
							controller.speakSample(text, overrides);
						}
					};
				}
			}, SpeechRow));
		}
		//#endregion
		exports.SETTINGS_NS = SETTINGS_NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map