'use strict';

// Fixture for the self-defining module pattern: the module calls
// mnemonica define() itself at require time and exports the resulting
// constructors. The loader must re-use them, not define() them again.
const { define } = require( 'mnemonica' );

const SelfDefined = define( 'SelfDefined', function ( data ) {
	this.payload = data.payload;
} );

const SelfChild = SelfDefined.define( 'SelfChild', function () {
	this.child = true;
} );

module.exports = { SelfDefined, SelfChild };
