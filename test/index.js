'use strict';

const loader = require( '../lib' );

const { expect } = require( 'chai' );
require( 'mocha' );

const cwd = process.cwd();

const TOPOLOGY_PATH = `${cwd}/test/tms`;
const passed = [];
const define = ( name ) => {
	passed.push( name );
	return {
		define
	};
};
const check = () => {
	return true;
};

loader( TOPOLOGY_PATH, define, check );

// Flat file tests
const FLAT_FILES_PATH = `${cwd}/test/fixtures/flat-files`;
const flatPassed = [];
const flatDefine = ( name ) => {
	flatPassed.push( name );
	return {
		define: flatDefine
	};
};

loader( FLAT_FILES_PATH, flatDefine, check );

describe( 'type collecting works', () => {
	it( 'test for string', () => {
		expect( passed.length ).equal( 4 );
	} );
	it( 'test for names', () => {
		expect( passed ).to.include( 'App' );
		expect( passed ).to.include( 'Nested' );
		expect( passed ).to.include( 'Sub' );
		expect( passed ).to.include( 'SubSub' );
	} );
	it( 'test for logs', () => {
		expect( passed ).to.include( 'App' );
		expect( passed ).to.include( 'Nested' );
		expect( passed ).to.include( 'Sub' );
		expect( passed ).to.include( 'SubSub' );
	} );
} );

describe( 'flat file loading works', () => {
	it( 'should find flat files', () => {
		expect( flatPassed.length ).to.be.at.least( 2 );
	} );
	it( 'should find Usages from flat file', () => {
		expect( flatPassed ).to.include( 'Usages' );
	} );
	it( 'should find Definition from flat file', () => {
		expect( flatPassed ).to.include( 'Definition' );
	} );
	it( 'should find Link (nested export)', () => {
		expect( flatPassed ).to.include( 'Link' );
	} );
	it( 'should skip lowercase files (helper.js)', () => {
		expect( flatPassed ).to.not.include( 'helper' );
	} );
} );

