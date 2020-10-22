'use strict';

const loader = require('../lib');

const {expect} = require('chai');
require('mocha');


const cwd = process.cwd();

const TOPOLOGY_PATH = `${ cwd }/test/tms`;
const passed = [];
const define = (name) => {
	passed.push(name);
	return {
		define
	};
};
const check = () => {
	return true;
};

// const {
// 	topology,
// 	logs
// } = 
loader(TOPOLOGY_PATH, define, check);

describe('type collecting works', () => {
	it('test for string', () => {
		expect(passed.length).equal(4);
	});
	it('test for names', () => {
		expect(passed).to.include('App');
		expect(passed).to.include('Nested');
		expect(passed).to.include('Sub');
		expect(passed).to.include('SubSub');
	});
	it('test for logs', () => {
		expect(passed).to.include('App');
		expect(passed).to.include('Nested');
		expect(passed).to.include('Sub');
		expect(passed).to.include('SubSub');
	});
});

