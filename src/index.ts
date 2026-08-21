'use strict';

import * as fs from 'fs';
import * as path from 'path';

// NB: a plain require on purpose, not an `import` — mnemonica's .d.ts
// uses TS-5-only syntax (`const` type params, template-literal types)
// which this package's old compiler cannot even parse, and all we need
// at runtime is the 'Mnemonica' marker string.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MNEMONICA } = require( 'mnemonica' ) as { MNEMONICA: string };

const logs: string[][] = [];

const push2logs = ( ...args: string[] ) => {
	logs.push( args );
};

// Find index file in directory (index.js, index.ts, index.mjs)
const findIndexFile = ( dirPath: string ): string | null => {
	const exts = [ '.js', '.ts', '.mjs' ];
	for ( const ext of exts ) {
		const indexPath = path.join( dirPath, `index${ext}` );
		if ( fs.existsSync( indexPath ) ) {
			return indexPath;
		}
	}
	return null;
};

// Check if name starts with capital letter (MNEMONICA requirement)
const isCapitalized = ( name: string ): boolean => {
	if ( !name || name.length === 0 ) {
		return false;
	}
	const firstChar = name.charAt( 0 );
	return firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
};

// Detection for constructors already produced by mnemonica define():
// they carry `.collection`, and every collection answers the MNEMONICA key
// (see core src/descriptors/types/index.ts). Such modules have self-defined
// their exports at require time, so the loader must re-use the constructor
// instead of calling define() again, which would throw ALREADY_DECLARED.
const isDefinedType = ( handler: CallableFunction ): boolean => {
	const { collection } = handler as { collection?: Record<string, unknown> };
	if ( !collection || typeof collection !== 'object' ) {
		return false;
	}
	return Boolean( collection[ MNEMONICA ] );
};

type TypeDef = {
	TypeName?: string,
	define: CallableFunction
}

// Either define a fresh type from a plain handler, or re-use the
// constructor when the module already self-defined it (isDefinedType).
const resolveType = (
	define: CallableFunction,
	name: string,
	handler: CallableFunction
): TypeDef => {
	if ( isDefinedType( handler ) ) {
		push2logs( 'already defined, re-using:', name );
		return handler as unknown as TypeDef;
	}
	return define( name, handler ) as TypeDef;
};

// Inline subtypes are only harvested from plain handlers: on an already
// defined mnemonica constructor the own function props are the mnemonica
// API itself (define, lookup, ...), not subtype candidates.
const collectInliners = ( type: TypeDef, handler: CallableFunction ): void => {
	if ( isDefinedType( handler ) ) {
		return;
	}
	addInliners( type, handler );
};

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
	topology?: Record<string, TopDef>,
	logs?: string[][]
}

type Entry = {
	name: string;
	fullPath: string;
	isFile: boolean;
	isDirectory: boolean;
};

const loader = (
	topologyPath: string,
	define: CallableFunction,
	checker: CallableFunction = () => true,
): LoaderOutput => {

	const topology: Record<string, TopDef> = Object.create( null );

	// Check if path is file or directory
	let pathStat: fs.Stats;
	try {
		pathStat = fs.statSync( topologyPath );
	} catch ( e ) {
		push2logs( 'path not found:', topologyPath );
		return { topology, logs };
	}

	// If it's a file, process just that file
	if ( pathStat.isFile() ) {
		const ext = path.extname( topologyPath );
		if ( !/\.(js|ts|mjs)$/.test( ext ) ) {
			push2logs( 'skipping (not a supported file type):', topologyPath );
			return { topology, logs };
		}

		const baseName = path.basename( topologyPath, ext );
		const dirName = path.dirname( topologyPath );

		push2logs( 'loading file:', topologyPath );

		let starter: unknown;
		try {
			starter = require( topologyPath );
		} catch ( e ) {
			push2logs( 'error requiring file:', topologyPath, String( e ) );
			return { topology, logs };
		}

		// Process exports from the file
		if ( starter instanceof Function ) {
			// Direct export of a function
			const handler = starter as CallableFunction;
			const constructorName = handler.name || baseName;

			if ( !isCapitalized( constructorName ) ) {
				push2logs( 'skipping (lowercase):', constructorName );
				return { topology, logs };
			}

			push2logs( 'definition of:', constructorName );
			const type = resolveType( define, constructorName, handler );

			// Check for nested directory with same name
			const nestedDir = path.join( dirName, constructorName );
			if ( fs.existsSync( nestedDir ) ) {
				const nestedStat = fs.statSync( nestedDir );
				if ( nestedStat.isDirectory() ) {
					const kids = loader(
						nestedDir,
						type.define.bind( type ),
						checker
					);
					topology[ constructorName ] = {
						name: constructorName,
						path: topologyPath,
						type: type as unknown as CallableFunction,
						kids: kids.topology ? Object.values( kids.topology ) : [],
					};
					return { topology, logs };
				}
			}

			// Check for inline subtypes on the handler
			collectInliners( type, handler );

			topology[ constructorName ] = {
				name: constructorName,
				path: topologyPath,
				type: type as unknown as CallableFunction,
				kids: [],
			};
		} else if ( starter && typeof starter === 'object' ) {
			// Named exports - process each capitalized function
			for ( const [ exportKey, value ] of Object.entries( starter as Record<string, unknown> ) ) {
				if ( !( value instanceof Function ) ) {
					continue;
				}

				const handler = value as CallableFunction;
				const constructorName = handler.name || exportKey;

				// Must be capitalized
				if ( !isCapitalized( constructorName ) ) {
					push2logs( 'skipping (lowercase):', constructorName );
					continue;
				}

				push2logs( 'definition of:', constructorName );
				const type = resolveType( define, constructorName, handler );

				// Check for nested directory with same name
				const nestedDir = path.join( dirName, constructorName );
				let kids: LoaderOutput = { topology: {} };
				if ( fs.existsSync( nestedDir ) ) {
					const nestedStat = fs.statSync( nestedDir );
					if ( nestedStat.isDirectory() ) {
						kids = loader(
							nestedDir,
							type.define.bind( type ),
							checker
						);
					}
				}

				// Check for inline subtypes on the handler
				collectInliners( type, handler );

				topology[ constructorName ] = {
					name: constructorName,
					path: topologyPath,
					type: type as unknown as CallableFunction,
					kids: kids.topology ? Object.values( kids.topology ) : [],
				};
			}
		}

		return { topology, logs };
	}

	// It's a directory - collect entries
	if ( !pathStat.isDirectory() ) {
		push2logs( 'path is neither file nor directory:', topologyPath );
		return { topology, logs };
	}

	const entries: Entry[] = [];

	// Read directory contents
	const dirEntries = fs.readdirSync( topologyPath, { withFileTypes: true } );

	for ( const dirent of dirEntries ) {
		const name = dirent.name;

		// Skip hidden files/dirs
		if ( name.startsWith( '.' ) ) {
			continue;
		}

		// Skip if checker fails
		if ( !checker( name, dirent ) ) {
			continue;
		}

		const fullPath = path.join( topologyPath, name );

		if ( dirent.isDirectory() ) {
			entries.push( {
				name,
				fullPath,
				isFile: false,
				isDirectory: true,
			} );
		} else if ( dirent.isFile() && /\.(js|ts|mjs)$/.test( name ) ) {
			// It's a supported file
			const baseName = path.basename( name, path.extname( name ) );
			entries.push( {
				name: baseName,
				fullPath,
				isFile: true,
				isDirectory: false,
			} );
		}
	}

	if ( !entries.length ) {
		return { topology, logs };
	}

	push2logs( 'topologyPath : ', topologyPath );
	push2logs( 'its manifest : ', entries.map( ent => ent.name ).join( ' ' ) );

	// Process each entry
	for ( const entry of entries ) {
		// Skip entries with lowercase names
		if ( !isCapitalized( entry.name ) ) {
			push2logs( 'skipping (lowercase):', entry.name );
			continue;
		}

		if ( entry.isDirectory ) {
			// Check for index file first
			const indexPath = findIndexFile( entry.fullPath );

			if ( indexPath ) {
				// Directory with index file - process it
				let starter: unknown;
				try {
					starter = require( indexPath );
				} catch ( e ) {
					push2logs( 'error requiring index:', indexPath, String( e ) );
					continue;
				}

				push2logs( 'definition of: ', entry.name );

				const handler = ( starter instanceof Function ) ?
					starter : ( starter as Record<string, CallableFunction> )[ entry.name ];

				if ( !handler ) {
					push2logs( 'no handler found for:', entry.name );
					continue;
				}

				const type = resolveType( define, entry.name, handler );

				const kids = loader(
					entry.fullPath,
					type.define.bind( type ),
					checker
				);

				topology[ entry.name ] = {
					name: entry.name,
					path: entry.fullPath,
					type: type as unknown as CallableFunction,
					kids: kids.topology ? Object.values( kids.topology ) : [],
				};

				collectInliners( type, handler );
			} else {
				// Directory without index - recurse with current define
				const kids = loader( entry.fullPath, define, checker );
				if ( kids.topology ) {
					Object.assign( topology, kids.topology );
				}
			}
		} else {
			// It's a file - process it
			let starter: unknown;
			try {
				starter = require( entry.fullPath );
			} catch ( e ) {
				push2logs( 'error requiring file:', entry.fullPath, String( e ) );
				continue;
			}

			if ( starter instanceof Function ) {
				// Direct export
				const handler = starter as CallableFunction;
				const constructorName = handler.name || entry.name;

				if ( !isCapitalized( constructorName ) ) {
					push2logs( 'skipping (lowercase):', constructorName );
					continue;
				}

				push2logs( 'definition of: ', constructorName );
				const type = resolveType( define, constructorName, handler );

				// Check for nested directory with same name
				const nestedDir = path.join( topologyPath, constructorName );
				let kids: LoaderOutput = { topology: {} };
				if ( fs.existsSync( nestedDir ) ) {
					const nestedStat = fs.statSync( nestedDir );
					if ( nestedStat.isDirectory() ) {
						kids = loader(
							nestedDir,
							type.define.bind( type ),
							checker
						);
					}
				}

				collectInliners( type, handler );

				topology[ constructorName ] = {
					name: constructorName,
					path: entry.fullPath,
					type: type as unknown as CallableFunction,
					kids: kids.topology ? Object.values( kids.topology ) : [],
				};
			} else if ( starter && typeof starter === 'object' ) {
				// Named exports - process each capitalized function
				for ( const [ exportKey, value ] of Object.entries( starter as Record<string, unknown> ) ) {
					if ( !( value instanceof Function ) ) {
						continue;
					}

					const handler = value as CallableFunction;
					const constructorName = handler.name || exportKey;

					// Must be capitalized
					if ( !isCapitalized( constructorName ) ) {
						push2logs( 'skipping (lowercase):', constructorName );
						continue;
					}

					push2logs( 'definition of: ', constructorName );
					const type = resolveType( define, constructorName, handler );

					// Check for nested directory with same name
					const nestedDir = path.join( topologyPath, constructorName );
					let kids: LoaderOutput = { topology: {} };
					if ( fs.existsSync( nestedDir ) ) {
						const nestedStat = fs.statSync( nestedDir );
						if ( nestedStat.isDirectory() ) {
							kids = loader(
								nestedDir,
								type.define.bind( type ),
								checker
							);
						}
					}

					collectInliners( type, handler );

					topology[ constructorName ] = {
						name: constructorName,
						path: entry.fullPath,
						type: type as unknown as CallableFunction,
						kids: kids.topology ? Object.values( kids.topology ) : [],
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

export default loader;
(module).exports = exports.default;
exports.default.default = exports.default;
exports.default.topologica = exports.default;
