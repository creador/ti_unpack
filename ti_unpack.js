/*
reads AssetCryptImpl files and return struct with Titanium file names and source codes.
*/
var fs = require('fs');
var java = require('java');
java.classpath.push('java/commons-lang-2.6.jar');

var resp = {};
var global = {};
var classes = {
	charset 	: 	java.import('java.nio.charset.Charset'),
	integer 	: 	java.import('java.lang.Integer'),
	string 		: 	java.import('java.lang.String'),
	escapeu 	: 	java.import('org.apache.commons.lang.StringEscapeUtils'),
	charbuf 	: 	java.import('java.nio.CharBuffer')
};

var init = function(config, onReady) {
	// read AssetCryptImpl.java (for content)
	// read AssetCryptImpl.smali (for ranges)
	var reply = {};
	fs.readFile('test/AssetCryptImpl.java','utf8', function(err, data1) {
		if (err) throw err;
		reply.java = data1;
		fs.readFile('test/AssetCryptImpl.smali','utf8', function(err2, data2) {
			if (err2) throw err2;
			reply.smali = data2;
			onReady(reply);
		});
	});
};

init({}, function(info) {
	console.log(classes);
});