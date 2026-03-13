'use strict';

const Definition = function (data) {
	this.id = data.id;
	this.name = data.name;
};

const Link = function (data) {
	this.source = data.source;
	this.target = data.target;
};

module.exports = { Definition, Link };
