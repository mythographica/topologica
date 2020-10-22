'use strict';

import * as fs from 'fs';

const logs: string[][] = [];

const push2logs = ( ...args: string[] ) => {
	logs.push( args );
};

const topologise = ( path: string, check: CallableFunction = () => true ): fs.Dirent[] => {
	const manifest = fs.readdirSync( path, {
		withFileTypes: true
	} ).filter( ( dirent: fs.Dirent ) => {
		const { name } = dirent;
		return dirent.isDirectory() && check( name, dirent );
	} );
	return manifest;
};

type TypeDef = {
	TypeName?: string,
	define: CallableFunction
}

const addInliners = ( type: TypeDef, handler: CallableFunction ) => {

	const inliners = Object.entries( handler ).filter( entry => {
		const [ , pretendToBeHandler ] = entry;
		return pretendToBeHandler instanceof Function;
	} );

	if ( inliners.length ) {
		inliners.forEach( ( [ name, nestedHandler ] ) => {
			push2logs( `~ inliner for ${type.TypeName} > ${name}` );
			const sub = type.define( name, nestedHandler );
			addInliners( sub, nestedHandler );
		} );
	}
};


type TopDef = {
	name: string,
	path: string,
	type: CallableFunction,
	kids: TopDef[],
}

type LoaderOutput = {
	topology?: TopDef,
	logs?: string[][]
}

const loader = (
	topologyPath: string,
	define: CallableFunction,
	checker?: CallableFunction,
): LoaderOutput => {

	const topology = Object.create( null );

	const manifest: fs.Dirent[] = topologise( topologyPath, checker );
	if ( !manifest.length ) {
		return {};
	}

	push2logs( 'topologyPath : ', topologyPath );
	push2logs( 'its manifest : ', manifest.map( ent => ent.name ).join( ' ' ) );

	manifest.forEach( ( { name } ) => {

		const path = `${topologyPath}/${name}`;

		const starter = require( path );

		push2logs( 'definition of: ', name );

		const handler = ( starter instanceof Function ) ?
			starter : starter[ name ];

		const type = define( name, handler );

		const kids = loader(
			path,
			type.define.bind( type )
		);

		topology[ name ] = {
			name,
			path,
			type,
			kids,
		};

		addInliners( type, handler );

	} );

	return {
		topology,
		logs
	};

};

export default loader;
(module).exports = exports.default;
exports.default.default = exports.default;
exports.default.topologica = exports.default;
