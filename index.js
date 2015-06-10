var fs = require("fs");
var util = require("util");
var opts;
var file_path = '';
var file_name = '';
var file_ext = '';
var log = [];

function parseFileAsync(file, cbFunc){
	var errMsg = '';
	
	write("Opening File...");
	OpenFile(file, 'r', function(err, fd){
		if(err){
			errMsg = "Error: Opening file " + file + " (" + err + ")";
			write(errMsg);
			cbFunc(errMsg, null);
		}

		write("Getting file stats...")
		fs.fstat(fd, function(err, stats){
			if(err){
				errMsg = "Error: Getting file stats. (" + err + ")";
				write(errMsg);
				cbFunc(errMsg, null);
			}

			write("File Size: " + stats.size);
			var buffer = new Buffer(stats.size);

			write("Reading file...");
			fs.read(fd, buffer, 0, stats.size, 0, function(err, bytesRead, buffer){
				if(err){
					errMsg = "Error: Can not read file: " + err;
					write(errMsg);

					cbFunc(errMsg, null);
				}

				var str = buffer.toString();
				
				parseText(str, function(err, obj){
					write("Closing file...");
					fs.close(fd, function(c_err){
						cbFunc(err, obj);
					})
				});
			});
		});
	});	
}

function parseFileSync(file){
	var errMsg = '';

	write("Opening file...");
	var fd = fs.openSync(file, 'r');
		
	if(fd !== null && fd != undefined){
		write("Getting file stats...");
		var stats = fs.fstatSync(fd);
		
		if(stats !== null && stats != undefined){
			write("File Size: " + stats.size);
			var buffer = new Buffer(stats.size);
			write("Reading file...");
			var bytesRead = fs.readSync(fd, buffer, 0, stats.size, 0);
			var str = buffer.toString();

			write("Closing file...");
			fs.closeSync(fd);

			return parseText(str);
		}
		else{
			errMsg = "Error: Retrieving file stats.";
			write(errMsg);

			fs.closeSync(fd);
		}
	}
	else{
		errMsg = "Error: Opening file, " + file;
		write(errMsg);
	}

	return {err: errMsg, data: data};
}

function parseText(text, cbFunc){
	write("Parse Started...");
	var isAsync = isCallbackFunc(cbFunc);
	var err = null;
	var data = null;
	var num_lines = 0;
	var lines = [];

	if(text && typeof text == "string"){
		var s_time = process.hrtime(); //start counter

		if(text.indexOf('\r\n') > -1){
			lines = text.split('\r\n');
		}
		else if(text.indexOf('\n') > -1){
			lines = text.split('\n');
		}

		num_lines = lines.length;
		
		if(num_lines > 0){
			data = {};
			var obj = null;
			var line = null;
			var c_type = null; // current type
			var isHeader = true;
			var last_line = num_lines - 1;

			for(var i = 0; i <= last_line; i++){
				line = lines[i];

				if(line == undefined || line == '' || line == null){
					if(i == last_line && obj != null){
						if(!data.material){ data.material = []; }
						data.material.push(obj);
					}

					continue;
				}

				if(line.charAt(0) == "#"){
					if(isHeader){
						if(!data.comments){
							data.comments = [];
						}

						data.comments.push(line);
					}
					else{
						if(obj == null){obj = {};}
						if(!obj.comments){
							obj.comments = [];
						}

						obj.comments.push(line);
					}

					continue;
				}

				line = line.split(' ');

				c_type = line[0];
				if(c_type) c_type = c_type.toLowerCase();

				switch(c_type){
					case 'newmtl': // Material name
						// newmtl are the start of a new material object
						if(obj != null){
							if(!data.material){ data.material = []; }
							data.material.push(obj);
							obj = {};
						}
						else{
							obj = {};
						}

						write("Parsing Materal name (newmtl): " + line[1]);
						obj.use_material = line[1];
						isHeader = false;
						break;
					case 'ka': // Ambient reflectivity
					case 'kd': // Diffuse reflectivity
					case 'ks': // Specular reflectivity
					case 'tf': // Transmission filter
						var which = "unknown"; // which reflectivity
						if(c_type == "ka") which = "ambient";
						else if(c_type == "kd") which = "diffuse";
						else if(c_type == "ks") which = "specular";
						else if(c_type == "tf") which = "transmission";
						var s_type = line[1]; // statement type
						
						write("Parsing " + which + " " + (c_type == "tf" ? "Transmission filter" : "reflectivity") + " (" + c_type + ")...");
						
						if(obj == null) obj = {};
						
						var refObj = {type: s_type}; // reflectivity or transmission filter object;
						
						if(s_type == "spectral"){
							refObj.file = line[2];
							if(line.length > 3){
								refObj.factor = parseFloat(line[3]);
							}
						}
						else if(s_type == "xyz"){
							refObj.vals = [
								parseFloat(line[2]), // x
								parseFloat(line[3]), // y
								parseFloat(line[4])  // z
							];
						}
						else{
							refObj.type = "rbg";
							refObj.vals = [
							  parseFloat(s_type),  // r = red
							  parseFloat(line[2]), // b = blue
							  parseFloat(line[3])  // g = green
							];
						}

						obj[which] = refObj;
						
						break;
					case 'illum': // Illumination model
						write("Parsing Illumination model (illum)...");
						if(obj == null) obj = {};
						obj.illumination = parseInt(line[1]);
						break;
					case 'd': // Dissolve
						write("Parsing Dissolve (d)...");
						if(obj == null) obj = {};
						obj.dissolve = {};
						if(line[1] == "-halo"){
							obj.dissolve.type = "halo";
							obj.dissolve.factor = parseFloat(line[2]);
						}
						else{
							obj.dissolve.type = "background";
							obj.dissolve.factor = parseFloat(line[1]);
						}
						break;
					case 'ns': // Specular Exponent
						write("Parsing Specular exponent (Ns)...");
						if(obj == null) obj = {};
						obj.specular_exp = parseInt(line[1]);
						break;
					case 'ni': // Optical density
						write("Parsing Optical density (Ni)...");
						if(obj == null) obj = {};
						obj.optical_density = parseFloat(line[1]);
						break;
					case 'sharpness': // Reflection Sharpness
						write("Parsing Sharpness (sharpness)...");
						if(obj == null) obj = {};
						obj.sharpness = parseInt(line[1]);
						break;
					//Texture Maps...
					case 'map_ka': // Ambient Color texture file
					case 'map_kd': // Diffuse color texture file
					case 'map_ks': // Specular color texture file
					case 'map_ns': // Specular exponent texture file
					case 'map_d':  // Dissolve texture file
					case 'decal':  
					case 'disp':
					case 'bump':
						var which = "unknown_map";
						switch(c_type){
							case 'map_ka': which = "ambient"; break;
							case 'map_kd': which = "diffuse"; break;
							case 'map_ks': which = "specular"; break;
							case 'map_ns': which = 'specular_exp'; break;
							case 'map_d': which = 'dissolve'; break;
							default:
								which = c_type;
						}
						write("Parsing Texutre Map " + which + " (" + c_type + ")...");
						if(!obj.texture_map) obj.texture_map = {};
						obj.texture_map[which] = parseMap(line);
						break;
					case 'map_aat':
						write("Parsing Anti-aliasing (map_aat)...");
						if(obj == null) obj = {};
						if(!obj.map) obj.map = {};
						obj.map.anti_alias = line[1];
						break;
					//Reflection Map...
					case 'refl':
						write("Parsing Reflection Map (refl)...");
						obj.reflection_map = parseMap(line);
						break;
					default:
						write("Unprocessed Line: (#" + i + ") " + lines[i]);
				}
			}
		}
		else{
			err = "Error: Can not split file data into lines.";
			write(err);
		}

		write("Parse Completed...");
		var d_time = process.hrtime(s_time);
		write("Parse time: " + d_time[0] + "s, " + d_time[1] + "ns");
		write("Number of Lines: " + num_lines);
	}
	else{
		err = "Error: No string passed to be parsed.";
		write(err);
	}

	if(isAsync){
		cbFunc(err, data);
	} else{
		return {err: err, data: data};
	}
}

function parseMap(line){
	var obj = {file:null, options:[]};
	for(var m = 1; m < line.length; m++){
		if(line[m].indexOf('.') > -1){
			obj.file = line[m];
		}
		else if(line[m] == "-type"){
			obj.type = line[m++];
		}
		else{
			var o = {};
			o[line[m]] = null;
			switch(line[m]){
				case '-o':
				case '-s':
				case '-t':
					o[line[m]] = [
						parseFloat(line[m++]), // u
						parseFloat(line[m++]), // v
						parseFloat(line[m++])  // w
					];
					break;
				case '-mm':
					o[line[m]] = [
						parseFloat(line[m++]), // base
						parseFloat(line[m++])  // gain
					];
					break;
				case '-texres':
				case '-bm':
				case '-boost':
					o[line[m]] = parseFloat(line[m++]);
					break;
				default:
					o[line[m]] = line[m++];
			}

			obj.options.push(o);
		}
	}

	return obj;
}

function OpenFile(file, option, cbFunc){
	if(isCallbackFunc(cbFunc)){
		if(!file) cbFunc("No file", null);
		fs.open(file, option, cbFunc);
	}
	else{
		if(!file) return false;
		return fs.openSync(file, option);
	}
}

function validateFile(file, cbFunc){
	var isAsync = isCallbackFunc(cbFunc);
	var err = false;

	if(!file || typeof file != "string"){
		err = "Error: No file provided or path not string.";

		if(isAsync){ cbFunc(err); }
		else{ return err; }
	}

	if(file.indexOf('.mtl') < 1){ // a .mtl is a vaild file name
		err = 'Error: Not a vaild MTL file: ' + file;
		
		if(isAsync){ cbFunc(err); }
		else{ return err; }
	}

	err = "Error: File doesn't exist: " + file;

	if(isAsync){
		fs.exists(file, function(exist){
			if(exist){
				err = false;
				parseFilePath(file);
			}

			cbFunc(err);
		});
	}
	else{
		if(fs.existsSync(file)){
			err = false;
			parseFilePath(file);
		}

		return err;
	}
}

function parseFilePath(file, cbFunc){
	var isAsync = isCallbackFunc(cbFunc);
	var err = false;

	if(!file || typeof file != "string"){
		err = "Error: No file path givin.";
		if(isAsync){cbFunc(err);}
		else{return err;}
	}
	else{
		if(file.indexOf('/') == -1 || file.indexOf('.') == -1){
			err = "Error: Not a valid file path or file.";
			if(isAsync){cbFunc(err);}
			else{return err;}
		}
		var f = file.split('/');
		var fn = f[f.length-1].split('.');
		file_name = fn[0];
		file_ext = fn[1];
		file_path = f.slice(0, f.length - 1).join('/') + '/';
	}
}

function getDefaultOptions(){
	return  {
		parseComments: false,
		verbose: false,
		logging: false,
		returnJSON: false,
		saveJSON: false
	};
}

function setOptions(options){
	opts = getDefaultOptions();
	
	if(options && typeof options == "object"){
		if(options.parseComments == true){
			opts.parseComments = true;
		}
		if(options.verbose == true){
			opts.verbose = true;
		}
		if(options.logging == true){
			opts.logging = true;
		}
		if(options.returnJSON == true){
			opts.returnJSON = true;
		}
		if(options.saveJSON == true){
			opts.saveJSON = true;
		}
	}

	writeToConsole("Setting options...");
}

function writeLoggingHeader(){
	writeToLog("MtlToJs - .mtl to JS Parser.");
	writeToLog("Log file from parsing file: " + file_path + file_name + '.' + file_ext);
	writeToLog("Options: " + JSON.stringify(opts));
	writeToLog(" ");
	writeToLog("===============================================================================================================================");
	writeToLog(" ");
}

function write(msg){
	writeToConsole(msg);
	writeToLog(msg);
}

function writeToLog(msg){
	if(opts.logging && msg){
		log.push(msg);
	}
}

function writeToConsole(txt, override){
	if((opts.verbose || override) && txt){
		console.log(txt);
	}
}

function isCallbackFunc(cbFunc){
	return cbFunc && typeof cbFunc == "function";
}

function getMtlFilePath(){
	return getPath('mtl');
}
function getJsonFilePath(){
	return getPath('json');
}
function getLogFilePath(){
	return getPath('log');
}

function getPath(ext){
	switch(ext){
		case 'mtl':
		case 'json':
		case 'log': return file_path + file_name + '.' + ext;
		default: return '';
	}
}

function processJSON(data, cbFunc){
	var isAsync = isCallbackFunc(cbFunc);
	var err = 0;

	if(opts.saveJSON || opts.returnJSON){
		if(data == null){
			err = "ERROR: Can not create JSON...  Data is null!";
			write(err);
			if(isAsync){cbFunc(err, null);}
			else{return null;}
		}
		else{
			writeToConsole("Creating JSON from data...");
			var json = JSON.stringify(data);

			if(opts.saveJSON){
				var jsonFile = getJsonFilePath();
				writeToConsole("Saving JSON file...");

				if(isAsync){
					fs.writeFile(jsonFile, json, function(wErr){
						if(wErr){
							err = "Error: Saving JSON file: " + wErr;
							write(err);
						}
						else{
							write("JSON saved to file " + jsonFile);
						}

						cbFunc(err, opts.returnJSON ? json : null);
					});
				}
				else{
					try{
						fs.writeFileSync(jsonFile, json);
						write("JSON saved to file " + jsonFile);
					}
					catch(e){
						write("Error: Can not save JSON file: " + e);
					}

					return opts.returnJSON ? json : null;
				}
			}
			else{
				if(isAsync){cbFunc(0, json);}
				else{return json;}
			}
		}
	}
	else{
		if(isAsync){cbFunc(0, null);}
		else{return null;}
	}
}

function saveLog(cbFunc){
	var isAsync = isCallbackFunc(cbFunc);
	var err = 0;

	if(opts.logging){
		writeToConsole("Saving Log file...");
		var logFile = getLogFilePath();

		if(log != null && log.length > 0){
			var logData = log.join('\r\n');

			if(isAsync){
				fs.writeFile(logFile, logData, function(wErr){
					if(wErr){
						err = "Error: Can not save log file: " + wErr;
						writeToConsole(err);
					}
					else{
						writeToConsole("Log file saved: " + logFile);
					}

					cbFunc(err);
				});
			}
			else{
				try{
					fs.writeFileSync(logFile, logData);
					writeToConsole("Log file saved: " + logFile);
				}
				catch(e){
					err = "Error: Can not save log file: " + e;
					writeToConsole(err);
				}

				return err;
			}
		}
		else{
			err = "Error: No log data recorded to save.";

			if(isAsync){cbFunc(err);}
			else{return err;}
		}
	}
	else{
		if(isAsync){cbFunc(err);}
		else{return err;}
	}
}

function parse(file, options, cbFunc){
	var ov_s_time = process.hrtime();
	var s_mem = process.memoryUsage();

	if(arguments.length == 0){
		writeToConsole("Error: No arguments found.", true);
		process.exit(1);
	}
	
	if((arguments.length == 2 && typeof options != "function")||(arguments.length == 3 && typeof cbFunc != "function")){
		writeToConsole("Error: No callback function provided.", true);
		process.exit(1);
	}

	if(arguments.length == 2){
		cbFunc = options;
		options = {};
	}

	setOptions(options);

	validateFile(file, function(err){
		if(err){
			write(err);
			cbFunc(err, null);
		}
		else{
			writeLoggingHeader();

			parseFileAsync(file, function(err, data){	
				processJSON(data, function(err, json){
					if(json != null){
						data.json = json;
					}

					write("Memory usage before parse: " + util.inspect(s_mem, {depth:null}));
					var u_mem = process.memoryUsage();
					write("Memory usage after parse: " + util.inspect(u_mem, {depth: null}));
					write("Total memory used: " + (u_mem.heapUsed - s_mem.heapUsed))

					var ov_e_time = process.hrtime(ov_s_time);
					write("Overall Run Time: " + ov_e_time[0] + "s, " + ov_e_time[1] + "ns");

					saveLog(function(err){
						cbFunc(err, data);
					});
				});
			});
		}
	});
}

function parseSync(file, options){
	var ov_s_time = process.hrtime();
	var s_mem = process.memoryUsage();
	
	setOptions(options);

	var err = validateFile(file);
	
	if(err){
		write(err);
		return {err: err, data:null};
	}
	
	writeLoggingHeader();

	var parsedObj = parseFileSync(file);
	var json = processJSON(parsedObj.data);

	write("Memory usage before parse: " + util.inspect(s_mem, {depth:null}));
	var u_mem = process.memoryUsage();
	write("Memory usage after parse: " + util.inspect(u_mem, {depth: null}));
	write("Total memory used: " + (u_mem.heapUsed - s_mem.heapUsed))

	var ov_e_time = process.hrtime(ov_s_time);
	write("Overall Run Time: " + ov_e_time[0] + "s, " + ov_e_time[1] + "ns");

	saveLog();

	var rData = {err: err, data: parsedObj};
	if(json) rData.json = json;

	return rData;
}

exports.parse = parse;
exports.parseSync = parseSync;