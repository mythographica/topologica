'use strict';
Object.defineProperty(exports, '__esModule', { value : true });
const fs = require('fs');
const logs = [];
const push2logs = (...args) => {
	logs.push(args);
};
const topologise = (path, check = () => true) => {
	const manifest = fs.readdirSync(path, {
		withFileTypes : true
	}).filter((dirent) => {
		const { name } = dirent;
		return dirent.isDirectory() && check(name, dirent);
	});
	return manifest;
};
const addInliners = (type, handler) => {
	const inliners = Object.entries(handler).filter(entry => {
		const [, pretendToBeHandler] = entry;
		return pretendToBeHandler instanceof Function;
	});
	if (inliners.length) {
		inliners.forEach(([name, nestedHandler]) => {
			push2logs(`~ inliner for ${type.TypeName} > ${name}`);
			const sub = type.define(name, nestedHandler);
			addInliners(sub, nestedHandler);
		});
	}
};
const loader = (topologyPath, define, checker) => {
	const topology = Object.create(null);
	const manifest = topologise(topologyPath, checker);
	if (!manifest.length) {
		return {};
	}
	push2logs('topologyPath : ', topologyPath);
	push2logs('its manifest : ', manifest.map(ent => ent.name).join(' '));
	manifest.forEach(({ name }) => {
		const path = `${topologyPath}/${name}`;
		const starter = require(path);
		push2logs('definition of: ', name);
		const handler = (starter instanceof Function) ?
			starter : starter[name];
		const type = define(name, handler);
		const kids = loader(path, type.define.bind(type));
		topology[name] = {
			name,
			path,
			type,
			kids,
		};
		addInliners(type, handler);
	});
	return {
		topology,
		logs
	};
};
exports.default = loader;
(module).exports = exports.default;
exports.default.default = exports.default;
exports.default.topologica = exports.default;
