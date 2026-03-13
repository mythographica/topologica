'use strict';
Object.defineProperty(exports, '__esModule', { value : true });
const fs = require('fs');
const path = require('path');
const logs = [];
const push2logs = (...args) => {
	logs.push(args);
};
const findIndexFile = (dirPath) => {
	const exts = ['.js', '.ts', '.mjs'];
	for (const ext of exts) {
		const indexPath = path.join(dirPath, `index${ext}`);
		if (fs.existsSync(indexPath)) {
			return indexPath;
		}
	}
	return null;
};
const isCapitalized = (name) => {
	if (!name || name.length === 0) {
		return false;
	}
	const firstChar = name.charAt(0);
	return firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
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
const loader = (topologyPath, define, checker = () => true) => {
	const topology = Object.create(null);
	let pathStat;
	try {
		pathStat = fs.statSync(topologyPath);
	}
	catch (e) {
		push2logs('path not found:', topologyPath);
		return { topology, logs };
	}
	if (pathStat.isFile()) {
		const ext = path.extname(topologyPath);
		if (!/\.(js|ts|mjs)$/.test(ext)) {
			push2logs('skipping (not a supported file type):', topologyPath);
			return { topology, logs };
		}
		const baseName = path.basename(topologyPath, ext);
		const dirName = path.dirname(topologyPath);
		push2logs('loading file:', topologyPath);
		let starter;
		try {
			starter = require(topologyPath);
		}
		catch (e) {
			push2logs('error requiring file:', topologyPath, String(e));
			return { topology, logs };
		}
		if (starter instanceof Function) {
			const handler = starter;
			const constructorName = handler.name || baseName;
			if (!isCapitalized(constructorName)) {
				push2logs('skipping (lowercase):', constructorName);
				return { topology, logs };
			}
			push2logs('definition of:', constructorName);
			const type = define(constructorName, handler);
			const nestedDir = path.join(dirName, constructorName);
			if (fs.existsSync(nestedDir)) {
				const nestedStat = fs.statSync(nestedDir);
				if (nestedStat.isDirectory()) {
					const kids = loader(nestedDir, type.define.bind(type), checker);
					topology[constructorName] = {
						name : constructorName,
						path : topologyPath,
						type : type,
						kids : kids.topology ? Object.values(kids.topology) : [],
					};
					return { topology, logs };
				}
			}
			addInliners(type, handler);
			topology[constructorName] = {
				name : constructorName,
				path : topologyPath,
				type : type,
				kids : [],
			};
		}
		else if (starter && typeof starter === 'object') {
			for (const [exportKey, value] of Object.entries(starter)) {
				if (!(value instanceof Function)) {
					continue;
				}
				const handler = value;
				const constructorName = handler.name || exportKey;
				if (!isCapitalized(constructorName)) {
					push2logs('skipping (lowercase):', constructorName);
					continue;
				}
				push2logs('definition of:', constructorName);
				const type = define(constructorName, handler);
				const nestedDir = path.join(dirName, constructorName);
				let kids = { topology : {} };
				if (fs.existsSync(nestedDir)) {
					const nestedStat = fs.statSync(nestedDir);
					if (nestedStat.isDirectory()) {
						kids = loader(nestedDir, type.define.bind(type), checker);
					}
				}
				addInliners(type, handler);
				topology[constructorName] = {
					name : constructorName,
					path : topologyPath,
					type : type,
					kids : kids.topology ? Object.values(kids.topology) : [],
				};
			}
		}
		return { topology, logs };
	}
	if (!pathStat.isDirectory()) {
		push2logs('path is neither file nor directory:', topologyPath);
		return { topology, logs };
	}
	const entries = [];
	const dirEntries = fs.readdirSync(topologyPath, { withFileTypes : true });
	for (const dirent of dirEntries) {
		const {name} = dirent;
		if (name.startsWith('.')) {
			continue;
		}
		if (!checker(name, dirent)) {
			continue;
		}
		const fullPath = path.join(topologyPath, name);
		if (dirent.isDirectory()) {
			entries.push({
				name,
				fullPath,
				isFile      : false,
				isDirectory : true,
			});
		}
		else if (dirent.isFile() && /\.(js|ts|mjs)$/.test(name)) {
			const baseName = path.basename(name, path.extname(name));
			entries.push({
				name        : baseName,
				fullPath,
				isFile      : true,
				isDirectory : false,
			});
		}
	}
	if (!entries.length) {
		return { topology, logs };
	}
	push2logs('topologyPath : ', topologyPath);
	push2logs('its manifest : ', entries.map(ent => ent.name).join(' '));
	for (const entry of entries) {
		if (!isCapitalized(entry.name)) {
			push2logs('skipping (lowercase):', entry.name);
			continue;
		}
		if (entry.isDirectory) {
			const indexPath = findIndexFile(entry.fullPath);
			if (indexPath) {
				let starter;
				try {
					starter = require(indexPath);
				}
				catch (e) {
					push2logs('error requiring index:', indexPath, String(e));
					continue;
				}
				push2logs('definition of: ', entry.name);
				const handler = (starter instanceof Function) ?
					starter : starter[entry.name];
				if (!handler) {
					push2logs('no handler found for:', entry.name);
					continue;
				}
				const type = define(entry.name, handler);
				const kids = loader(entry.fullPath, type.define.bind(type), checker);
				topology[entry.name] = {
					name : entry.name,
					path : entry.fullPath,
					type : type,
					kids : kids.topology ? Object.values(kids.topology) : [],
				};
				addInliners(type, handler);
			}
			else {
				const kids = loader(entry.fullPath, define, checker);
				if (kids.topology) {
					Object.assign(topology, kids.topology);
				}
			}
		}
		else {
			let starter;
			try {
				starter = require(entry.fullPath);
			}
			catch (e) {
				push2logs('error requiring file:', entry.fullPath, String(e));
				continue;
			}
			if (starter instanceof Function) {
				const handler = starter;
				const constructorName = handler.name || entry.name;
				if (!isCapitalized(constructorName)) {
					push2logs('skipping (lowercase):', constructorName);
					continue;
				}
				push2logs('definition of: ', constructorName);
				const type = define(constructorName, handler);
				const nestedDir = path.join(topologyPath, constructorName);
				let kids = { topology : {} };
				if (fs.existsSync(nestedDir)) {
					const nestedStat = fs.statSync(nestedDir);
					if (nestedStat.isDirectory()) {
						kids = loader(nestedDir, type.define.bind(type), checker);
					}
				}
				addInliners(type, handler);
				topology[constructorName] = {
					name : constructorName,
					path : entry.fullPath,
					type : type,
					kids : kids.topology ? Object.values(kids.topology) : [],
				};
			}
			else if (starter && typeof starter === 'object') {
				for (const [exportKey, value] of Object.entries(starter)) {
					if (!(value instanceof Function)) {
						continue;
					}
					const handler = value;
					const constructorName = handler.name || exportKey;
					if (!isCapitalized(constructorName)) {
						push2logs('skipping (lowercase):', constructorName);
						continue;
					}
					push2logs('definition of: ', constructorName);
					const type = define(constructorName, handler);
					const nestedDir = path.join(topologyPath, constructorName);
					let kids = { topology : {} };
					if (fs.existsSync(nestedDir)) {
						const nestedStat = fs.statSync(nestedDir);
						if (nestedStat.isDirectory()) {
							kids = loader(nestedDir, type.define.bind(type), checker);
						}
					}
					addInliners(type, handler);
					topology[constructorName] = {
						name : constructorName,
						path : entry.fullPath,
						type : type,
						kids : kids.topology ? Object.values(kids.topology) : [],
					};
				}
			}
		}
	}
	return {
		topology,
		logs
	};
};
exports.default = loader;
(module).exports = exports.default;
exports.default.default = exports.default;
exports.default.topologica = exports.default;
