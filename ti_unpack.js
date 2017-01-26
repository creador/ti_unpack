/*
reads AssetCryptImpl files and return struct with Titanium file names and source codes.
*/
var fs = require('fs');
var lineReader = require('line-reader');
var java = require('java');
java.classpath.push('java/commons-lang-2.6.jar');

var resp = {};
var meta = {
	totalBytes 	: 	0,
	ti_version 	: 	-1,
	alloy 		: 	false
};
var classes = {
	charset 	: 	java.import('java.nio.charset.Charset'),
	integer 	: 	java.import('java.lang.Integer'),
	string 		: 	java.import('java.lang.String'),
	escapeu 	: 	java.import('org.apache.commons.lang.StringEscapeUtils'),
	charbuf 	: 	java.import('java.nio.CharBuffer')
};

var init = function(config, onReady) {
	// read AssetCryptImpl.smali (for ranges)
	// get bytes from smali
	var bytesC = { start:false, bufferlen:0, charbuf:'', line:'', array:[] };
	var count = 0;
	lineReader.eachLine('test/AssetCryptImpl.smali', function(line, last){
		bytesC.line = line;
		if (line.indexOf('private static initAssetsBytes()Ljava/nio/CharBuffer')!=-1) {
			bytesC.start = true;
		} else if (bytesC.start && line.indexOf('const v0, ')!=-1) {
			// titanium < v5
			meta.ti_version = -5;
			bytesC.line = line.split('const v0, ').join('').trim();
			bytesC.bufferlen = classes.integer.decodeSync(bytesC.line);
			bytesC.charbuf = classes.charbuf.allocateSync(bytesC.bufferlen);
		} else if (bytesC.start && line.indexOf('const/16 v0, ')!=-1) {
			// titanium v5.x +
			meta.ti_version = 5;
			bytesC.line = line.split('const/16 v0, ').join('').trim();
			bytesC.bufferlen = classes.integer.decodeSync(bytesC.line);
			bytesC.charbuf = classes.charbuf.allocateSync(bytesC.bufferlen);
		} else if (bytesC.start && line.indexOf('const-string v1')!=-1) {
			// content
			bytesC.line = line.split('const-string v1, "').join('').trim();
			bytesC.line = bytesC.line.slice(0,-1); // remove last " char
			bytesC.line = classes.escapeu.unescapeJavaSync(bytesC.line);
			bytesC.charbuf.append(bytesC.line);
		} else if (line.indexOf('rewind()Ljava/nio/Buffer;')!=-1) {
			bytesC.charbuf.rewind();
			console.log('decoding bytes ...');
			/* */
			bytesC.assetBytes = classes.charset.forNameSync('ISO-8859-1').encodeSync(bytesC.charbuf).arraySync();
			console.log('converting into java array of bytes ... takes some time');
			var iii, _cnt=0, _inbytes = [];
			for (iii in bytesC.assetBytes) {
				_inbytes.push(java.newByte(bytesC.assetBytes[iii]));
			}
			_inbytes2 = java.newArray("byte",_inbytes);
			//read file byte ranges from AssetCryptImpl.java
			var passed_maps = false;
			console.log('extracting file ranges ...');
			meta.totalBytes = 0;
			lineReader.eachLine('test/AssetCryptImpl.java', function(line2, last2) {
				var tmp = {};
				if (line2.indexOf('hashmap.put')!=-1) {
					tmp.file = line2.split(',')[0].split('hashmap.put(').join('').split('"').join('').trim();
					tmp.offset = line2.split(',')[1].split('new Range(').join('').trim();
					tmp.length = line2.split(',')[2].split('));').join('').trim();
					resp[tmp.file] = {
						offset 	: 	classes.integer.decodeSync(tmp.offset),
						bytes 	: 	classes.integer.decodeSync(tmp.length)
					};
					resp[tmp.file].content = filterDataInRange(tmp.file, _inbytes2, resp[tmp.file].offset, resp[tmp.file].bytes);
					meta.totalBytes += resp[tmp.file].bytes;
					passed_maps = true;
				} else {
					if (passed_maps) {
						onReady(bytesC, resp);
						return false;
					}
				}
			});
		}
	});
};

var filterDataInRange = function(filename, ibytes, offset, length) {
	var _resp = '', _respb = '', _bytes_len=ibytes.length;
	var key = java.import('javax.crypto.spec.SecretKeySpec');
	// FIRST ATTEMPT
	try {
		// titanium below 3.2.2 and 3.4.0 decryption requires byteslen - 1
		_bytes_len = ibytes.length-1;
		var secretKeySpec = new key(	ibytes,
										_bytes_len - classes.integer.decodeSync("0x10"), 
										classes.integer.decodeSync("0x10"), 
										'AES');
		var _cipher = java.import('javax.crypto.Cipher').getInstanceSync('AES');
		var _decrypt_mode = 2; 	//cipher["DECRYPT_MODE"];
		_cipher.initSync(_decrypt_mode, secretKeySpec);
		try {
			_respb = _cipher.doFinalSync(ibytes, offset, length);
			_resp = String.fromCharCode.apply(null, new Uint16Array(_respb));
		} catch(e1a) {
			_respb = _cipher.doFinalSync(ibytes, offset-1, length);	//some files have the offset padded
			_resp = String.fromCharCode.apply(null, new Uint16Array(_respb));
		}

	} catch(e1) {
		_resp = '';	
	}
	// SECOND ATTEMPT
	if (_resp=='') {
		try {
			// titanium over v3.4.0
			_bytes_len = ibytes.length;
			var secretKeySpec = new key(	ibytes,
											_bytes_len - classes.integer.decodeSync("0x10"), 
											classes.integer.decodeSync("0x10"), 
											'AES');
			var _cipher = java.import('javax.crypto.Cipher').getInstanceSync('AES');
			var _decrypt_mode = 2; 	//cipher["DECRYPT_MODE"];
			_cipher.initSync(_decrypt_mode, secretKeySpec);
			try {
				_respb = _cipher.doFinalSync(ibytes, offset, length);
				_resp = String.fromCharCode.apply(null, new Uint16Array(_respb));
			} catch(e1a) {
				_respb = _cipher.doFinalSync(ibytes, offset-1, length);	//some files have the offset padded
				_resp = String.fromCharCode.apply(null, new Uint16Array(_respb));
			}

		} catch(e2) {
			_resp = '';
		}
	}
	if (_resp!='') console.log('file:'+filename+', decrypted !');
	return _resp;
};

var unpack2dir = function(obj) {
	// writes the decoded files from memory into the given directory (creating as needed)

};

exports.init = init;
exports.unpack2dir = unpack2dir;

/* uncomment for testing
init({}, function(info, full) {
	//console.log(info);
	console.log(full);
	console.log(meta);
});*/