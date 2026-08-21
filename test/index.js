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

// Self-defined modules: exports are already mnemonica constructors,
// the loader must re-use them instead of re-defining (ALREADY_DECLARED)
const SELF_DEFINED_PATH = `${cwd}/test/fixtures/self-defined`;
const { define: realDefine, lookup: realLookup } = require( 'mnemonica' );

let selfDefinedResult = null;
let selfDefinedError = null;
try {
	selfDefinedResult = loader( SELF_DEFINED_PATH, realDefine, check );
} catch ( e ) {
	selfDefinedError = e;
}

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

describe( 'self-defined modules are re-used, not re-defined', () => {
	it( 'should not throw ALREADY_DECLARED', () => {
		expect( selfDefinedError ).to.equal( null );
	} );
	it( 'should collect self-defined exports into topology', () => {
		expect( selfDefinedResult ).to.have.property( 'topology' );
		expect( selfDefinedResult.topology ).to.have.property( 'SelfDefined' );
		expect( selfDefinedResult.topology ).to.have.property( 'SelfChild' );
	} );
	it( 'should re-use the very same constructor the module defined', () => {
		const registered = realLookup( 'SelfDefined' );
		expect( selfDefinedResult.topology.SelfDefined.type ).to.equal( registered );
	} );
	it( 'should not shadow subtypes with new root definitions', () => {
		const child = realLookup( 'SelfDefined.SelfChild' );
		expect( child ).to.not.equal( undefined );
		expect( selfDefinedResult.topology.SelfChild.type ).to.equal( child );
	} );
	it( 'should not treat mnemonica API props as inline subtypes', () => {
		expect( realLookup( 'SelfDefined.define' ) ).to.equal( undefined );
		expect( realLookup( 'SelfDefined.lookup' ) ).to.equal( undefined );
	} );
} );

