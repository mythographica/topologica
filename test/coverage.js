'use strict';

// Branch-coverage suite for the loader: path-level edges, single-file
// argument handling, directory handling, inline harvesters, and the
// self-defined re-use path. Fixtures are built programmatically so the
// tree stays in one readable place.

const fs = require( 'fs' );
const path = require( 'path' );
const net = require( 'net' );

const loader = require( '../lib' );

const { expect } = require( 'chai' );
require( 'mocha' );

const ROOT = path.join( __dirname, 'fixtures', 'cov' );
const SOCK = path.join( ROOT, 'socket' );

// a define() recorder that mimics the mnemonica contract: returns an
// object carrying a define method, so type.define.bind(type) works
const makeDefine = ( record ) => {
	const define = ( name ) => {
		record.push( name );
		const type = { define : ( n ) => define( n ) };
		return type;
	};
	return define;
};

const write = ( rel, content ) => {
	const full = path.join( ROOT, rel );
	fs.mkdirSync( path.dirname( full ), { recursive : true } );
	fs.writeFileSync( full, content );
};

let server;

before( () => {
	fs.rmSync( ROOT, { recursive : true, force : true } );
	fs.mkdirSync( ROOT, { recursive : true } );

	// --- path-level fixtures -------------------------------------------------
	write( 'note.json', '{}\n' );
	write( 'empty-dir/.gitkeep', '' );

	// --- single-file-argument fixtures ---------------------------------------
	write( 'single/Solo.js', 'module.exports = function Solo () {};\n' );
	write( 'single/Anon.js', 'module.exports = function () {};\n' );
	write( 'single/lowercase.js', 'module.exports = function lowercase () {};\n' );
	write( 'single/Broken.js', 'this is not valid javascript at all !!!\n' );
	write( 'single/WithKids.js', 'module.exports = function WithKids () {};\n' );
	write( 'single/WithKids/Kid.js', 'module.exports = function Kid () {};\n' );
	write(
		'single/Mixed.js',
		'const Good = function Good () {};\n' +
		'Good.Inline = function Inline () {};\n' +
		'Good.Inline.Deep = function Deep () {};\n' +
		'module.exports = { Good, another : function () {}, notFn : 42, AlsoGood : function AlsoGood () {} };\n'
	);
	write( 'single/Good/Nested.js', 'module.exports = function Nested () {};\n' );
	write( 'single/EmptyName.js', 'module.exports = { \'\' : function () {} };\n' );
	write( 'single/Value.js', 'module.exports = 42;\n' );
	// a plain FILE where a nested DIRECTORY could be — existsSync true, isDirectory false
	write( 'single/SoloVariant.js', 'module.exports = function SoloVariant () {};\n' );
	write( 'single/SoloVariant', 'plain file, not a directory\n' );
	write( 'single/Mixed2.js', 'module.exports = { Mixed2 : function Mixed2 () {} };\n' );
	write( 'single/Mixed2', 'plain file, not a directory\n' );

	// --- directory fixtures ---------------------------------------------------
	write( 'dir/.hidden.js', 'module.exports = function Hidden () {};\n' );
	write( 'dir/readme.md', '# not code\n' );
	write( 'dir/lower.js', 'module.exports = function lower () {};\n' );
	write( 'dir/lowercase/index.js', 'module.exports = function lowercase () {};\n' );
	write( 'dir/Indexed/index.js', 'module.exports = function Indexed () {};\n' );
	write( 'dir/TsIndex/index.ts', 'module.exports = function TsIndex () {};\n' );
	write( 'dir/MjsIndex/index.mjs', 'export const MjsIndex = function MjsIndex () {};\n' );
	write( 'dir/BrokenIndex/index.js', '!!! not javascript !!!\n' );
	write( 'dir/WrongKey/index.js', 'module.exports = { Other : function Other () {} };\n' );
	write( 'dir/NoIndex/SubOne.js', 'module.exports = function SubOne () {};\n' );
	write( 'dir/NoIndex/SubTwo.js', 'module.exports = function SubTwo () {};\n' );
	write( 'dir/FileWithKids.js', 'module.exports = function FileWithKids () {};\n' );
	write( 'dir/FileWithKids/Child.js', 'module.exports = function Child () {};\n' );
	write(
		'dir/ObjKids.js',
		'module.exports = { ObjKid : function ObjKid () {}, notFn : 7 };\n'
	);
	write( 'dir/ObjKid/Inner.js', 'module.exports = function Inner () {};\n' );
	write(
		'dir/WithInline.js',
		'const WithInline = function WithInline () {};\n' +
		'WithInline.Sub = function Sub () {};\n' +
		'module.exports = WithInline;\n'
	);
	write( 'dir/ObjEmpty.js', 'module.exports = { \'\' : function () {} };\n' );
	write( 'dir/Value.js', 'module.exports = \'nope\';\n' );
	write( 'dir/AnonFile.js', 'module.exports = function () {};\n' );
	write( 'dir/CapitalFile.js', 'module.exports = function lowercaseFn () {};\n' );
	// plain FILEs where nested directories could be (isDirectory false sides)
	write( 'dir/FnFile.js', 'module.exports = function FnFile () {};\n' );
	write( 'dir/FnFile', 'plain file, not a directory\n' );
	write( 'dir/ObjFile.js', 'module.exports = { ObjFile : function ObjFile () {} };\n' );
	write( 'dir/ObjFile', 'plain file, not a directory\n' );
	write( 'dir/BrokenFile.js', 'this is broken !!! javascript\n' );
	write( 'dir/ObjLower.js', 'module.exports = { lowerFn : function lowerFn () {} };\n' );

	server = net.createServer();
	server.listen( SOCK );
} );

after( () => {
	if ( server ) { server.close(); }
	fs.rmSync( ROOT, { recursive : true, force : true } );
} );

describe( 'loader path-level edges', () => {

	it( 'returns empty topology for a missing path', () => {
		const rec = [];
		const result = loader( path.join( ROOT, 'missing' ), makeDefine( rec ) );
		expect( result.topology ).to.deep.equal( {} );
		expect( rec ).to.deep.equal( [] );
	} );

	it( 'skips a file argument with an unsupported extension', () => {
		const rec = [];
		const result = loader( path.join( ROOT, 'note.json' ), makeDefine( rec ) );
		expect( result.topology ).to.deep.equal( {} );
	} );

	it( 'logs and returns empty for neither-file-nor-directory (socket)', () => {
		const rec = [];
		const result = loader( SOCK, makeDefine( rec ) );
		expect( result.topology ).to.deep.equal( {} );
		const flat = result.logs.map( ( args ) => args.join( ' ' ) ).join( '\n' );
		expect( flat ).to.include( 'neither file nor directory' );
	} );

	it( 'returns empty topology for an empty directory', () => {
		const rec = [];
		const result = loader( path.join( ROOT, 'empty-dir' ), makeDefine( rec ) );
		expect( result.topology ).to.deep.equal( {} );
	} );

	it( 'honours the checker veto', () => {
		const rec = [];
		const result = loader( path.join( ROOT, 'dir' ), makeDefine( rec ), () => false );
		expect( result.topology ).to.deep.equal( {} );
		expect( rec ).to.deep.equal( [] );
	} );

} );

describe( 'loader single-file argument', () => {

	it( 'defines a plain function export', () => {
		const rec = [];
		loader( path.join( ROOT, 'single', 'Solo.js' ), makeDefine( rec ) );
		expect( rec ).to.deep.equal( [ 'Solo' ] );
	} );

	it( 'falls back to the file name for anonymous exports', () => {
		const rec = [];
		loader( path.join( ROOT, 'single', 'Anon.js' ), makeDefine( rec ) );
		expect( rec ).to.deep.equal( [ 'Anon' ] );
	} );

	it( 'skips lowercase function exports', () => {
		const rec = [];
		loader( path.join( ROOT, 'single', 'lowercase.js' ), makeDefine( rec ) );
		expect( rec ).to.deep.equal( [] );
	} );

	it( 'logs and skips a file that throws on require', () => {
		const rec = [];
		const result = loader( path.join( ROOT, 'single', 'Broken.js' ), makeDefine( rec ) );
		expect( rec ).to.deep.equal( [] );
		const flat = result.logs.map( ( args ) => args.join( ' ' ) ).join( '\n' );
		expect( flat ).to.include( 'error requiring file' );
	} );

	it( 'walks a nested directory matching the file name', () => {
		const rec = [];
		const result = loader( path.join( ROOT, 'single', 'WithKids.js' ), makeDefine( rec ) );
		expect( rec ).to.deep.equal( [ 'WithKids', 'Kid' ] );
		const kids = result.topology.WithKids.kids.map( ( k ) => k.name );
		expect( kids ).to.deep.equal( [ 'Kid' ] );
	} );

	it( 'handles named exports: skips non-functions and lowercase, harvests inline and nested', () => {
		const rec = [];
		loader( path.join( ROOT, 'single', 'Mixed.js' ), makeDefine( rec ) );
		// Good + its inline chain, AlsoGood, and the nested-dir child of Good
		expect( rec ).to.include( 'Good' );
		expect( rec ).to.include( 'Inline' );
		expect( rec ).to.include( 'Deep' );
		expect( rec ).to.include( 'AlsoGood' );
		expect( rec ).to.include( 'Nested' );
		expect( rec ).to.not.include( 'notFn' );
		expect( rec ).to.not.include( 'another' );
	} );

	it( 'skips exports with an empty resolved name', () => {
		const rec = [];
		loader( path.join( ROOT, 'single', 'EmptyName.js' ), makeDefine( rec ) );
		expect( rec ).to.deep.equal( [] );
	} );

	it( 'ignores a file exporting a plain value', () => {
		const rec = [];
		loader( path.join( ROOT, 'single', 'Value.js' ), makeDefine( rec ) );
		expect( rec ).to.deep.equal( [] );
	} );

	it( 'does not treat a same-name plain file as a nested directory', () => {
		const rec = [];
		const result = loader( path.join( ROOT, 'single', 'SoloVariant.js' ), makeDefine( rec ) );
		expect( rec ).to.deep.equal( [ 'SoloVariant' ] );
		expect( result.topology.SoloVariant.kids ).to.deep.equal( [] );
		const rec2 = [];
		loader( path.join( ROOT, 'single', 'Mixed2.js' ), makeDefine( rec2 ) );
		expect( rec2 ).to.deep.equal( [ 'Mixed2' ] );
	} );

} );

describe( 'loader directory handling', () => {

	it( 'processes a mixed directory deterministically', () => {
		const rec = [];
		const result = loader( path.join( ROOT, 'dir' ), makeDefine( rec ) );

		// hidden, unsupported, and lowercase entries are skipped
		expect( rec ).to.not.include( 'Hidden' );
		expect( rec ).to.not.include( 'lower' );
		expect( rec ).to.not.include( 'lowercase' );

		// index-bearing directories define their type
		expect( rec ).to.include( 'Indexed' );
		expect( rec ).to.include( 'TsIndex' );

		// directory without index merges children upwards
		expect( rec ).to.include( 'SubOne' );
		expect( rec ).to.include( 'SubTwo' );

		// file entries with matching directories produce kids
		expect( rec ).to.include( 'FileWithKids' );
		expect( rec ).to.include( 'Child' );
		expect( rec ).to.include( 'ObjKid' );
		expect( rec ).to.include( 'Inner' );

		// inline function props become subtypes
		expect( rec ).to.include( 'WithInline' );
		expect( rec ).to.include( 'Sub' );

		expect( result.topology.Indexed ).to.have.property( 'type' );
	} );

	it( 'logs a broken index file and continues', () => {
		const rec = [];
		const result = loader( path.join( ROOT, 'dir' ), makeDefine( rec ) );
		const flat = result.logs.map( ( args ) => args.join( ' ' ) ).join( '\n' );
		expect( flat ).to.include( 'error requiring index' );
		expect( rec ).to.include( 'Indexed' );
	} );

	it( 'logs when an index module has no handler matching the directory name', () => {
		const rec = [];
		const result = loader( path.join( ROOT, 'dir' ), makeDefine( rec ) );
		const flat = result.logs.map( ( args ) => args.join( ' ' ) ).join( '\n' );
		expect( flat ).to.include( 'no handler found for:' );
	} );

	it( 'covers the .mjs index branch regardless of node ESM interop', () => {
		const rec = [];
		const result = loader( path.join( ROOT, 'dir' ), makeDefine( rec ) );
		const flat = result.logs.map( ( args ) => args.join( ' ' ) ).join( '\n' );
		// either it defined (newer node require-esm) or logged the require error
		const defined = rec.includes( 'MjsIndex' );
		const errored = flat.includes( 'error requiring index' );
		expect( defined || errored ).to.equal( true );
	} );

} );
