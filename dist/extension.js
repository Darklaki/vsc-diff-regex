/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const vscode = __webpack_require__(1);
const parseDiff = __webpack_require__(3);
const path = __webpack_require__(4);
const utils_1 = __webpack_require__(5);
/*

@TODO: I don't like this class, please have a closer look later at what can be improved.
 */
class GitApi {
    constructor() {
        try {
            const gitExtension = vscode.extensions.getExtension("vscode.git");
            if (gitExtension == undefined) {
                throw new Error();
            }
            this._vscExtension = gitExtension;
        }
        catch (error) {
            console.log(error);
        }
    }
    /************
     *  Public  *
     ************/
    static get Instance() {
        return this._instance || (this._instance = new this());
    }
    async activateGit() {
        try {
            if (!this._vscExtension.isActive) {
                await this._vscExtension.activate();
            }
            this._vscGitExtension = this._vscExtension.exports;
            this._vscGitApi = this._vscGitExtension.getAPI(1);
            return true;
        }
        catch (error) {
            console.log(error);
            return false;
        }
    }
    async parseDiffs(config) {
        const getConfigurationProperty = (key, config) => {
            const configExists = config !== undefined;
            return (!configExists ||
                (configExists && (config[key] === undefined || config[key] === true)));
        };
        const includeUntracked = getConfigurationProperty("includeUntracked", config);
        const cleanAddChange = getConfigurationProperty("cleanAddChange", config);
        const cleanDelChange = getConfigurationProperty("cleanDelChange", config);
        const parsedDiffs = await this.diffsToObject();
        const changesInRepositories = await Promise.all(Object.entries(parsedDiffs)
            .map(([path]) => path)
            .map((repoPath) => new Promise(async (resolve) => {
            const parsedDiff = parsedDiffs[repoPath];
            const results = [];
            // Include changes from `git diff`
            if (parsedDiff) {
                parsedDiff.diffs.forEach((file) => {
                    const parsedChangedFile = {
                        changes: file.chunks.flatMap((chunk) => {
                            return chunk.changes
                                .filter((change) => change.content !== `\\ No newline at end of file`)
                                .map((change) => {
                                if (this.isParseDiffChangeAdd(change)) {
                                    return {
                                        line: change.ln - 1,
                                        content: cleanAddChange
                                            ? change.content.replace(/^\+/g, "")
                                            : change.content,
                                        type: "add",
                                        isVisible: true,
                                    };
                                }
                                else if (this.isParseDiffChangeDelete(change)) {
                                    return {
                                        line: change.ln - 1,
                                        content: cleanDelChange
                                            ? change.content.replace(/^\-/g, "")
                                            : change.content,
                                        type: "del",
                                        isVisible: false,
                                    };
                                }
                                else {
                                    return {
                                        line: change.ln1 - 1,
                                        content: change.content,
                                        type: "normal",
                                        isVisible: false,
                                    };
                                }
                            });
                        }),
                        // @NOTE: extension blocks cases where `git diff` cannot be parsed by parse-diff
                        filePath: file.from,
                        fileName: (0, utils_1.filenameFromPath)(file.from),
                        fullFilePath: `${parsedDiff.repository.rootUri.path}/${file.from}`,
                    };
                    results.push(parsedChangedFile);
                });
            }
            // Also include untracked files (included by default)
            if (includeUntracked) {
                const untrackedChanges = await this.parseUntrackedFilesInWorkspace(repoPath);
                results.push(...untrackedChanges);
            }
            resolve({
                [repoPath]: results,
            });
        })));
        return changesInRepositories.reduce((acc, x) => ({ ...acc, ...x }), {});
    }
    onDidChangeState(cb) {
        this._vscGitApi.onDidChangeState(cb);
    }
    get getState() {
        return this._vscGitApi.state;
    }
    async getWorkspaceRepositories() {
        const rootUri = vscode.workspace.workspaceFolders[0].uri;
        const rootRepo = this._vscGitApi.getRepository(rootUri);
        if (rootRepo !== null) {
            return {
                [rootUri.path]: rootRepo,
            };
        }
        return await (0, utils_1.findRepositories)(rootUri, this._vscGitApi, ["node_modules"]);
    }
    /*************
     *  Private  *
     *************/
    /**
     * Get file diffs in workspace repositories.
     */
    // working
    async diffsToObject() {
        const repositories = await this.getWorkspaceRepositories();
        const result = await Promise.all(Object.keys(repositories).map((repoPath) => new Promise(async (resolve) => {
            const repository = repositories[repoPath];
            const result = parseDiff(await repository.diff());
            resolve({
                [repoPath]: {
                    diffs: result,
                    repository,
                },
            });
        })));
        return result.reduce((acc, x) => ({ ...acc, ...x }), {});
    }
    async parseUntrackedFilesInWorkspace(directoryPath) {
        try {
            const result = [];
            const cleanedDirectoryPath = directoryPath.replace(/^\//g, "");
            // Exec command.
            const commandResult = await (0, utils_1.asyncExec)(`git -C "${cleanedDirectoryPath}" ls-files -o --exclude-standard`);
            // Get untracked files paths from command result string.
            const filePaths = commandResult
                .trim()
                .split("\n")
                .map((filename) => path.join(cleanedDirectoryPath, filename).replace(/\\/g, "/"));
            // Prepare for getting file contents.
            const contentGetters = [];
            filePaths.forEach((path) => {
                const relativeFilePath = path
                    .replace(cleanedDirectoryPath, "")
                    .replace(/^\//g, "");
                // Prepare Promises that will retrieve  file contents.
                contentGetters.push(new Promise(async (resolve) => {
                    try {
                        const textDocument = await vscode.workspace.openTextDocument(path);
                        const fileContent = textDocument.getText();
                        const fileLines = fileContent
                            .split("\n")
                            .map((l) => l.replace(/\r/g, "")); // Remove carriage return character.
                        resolve({
                            relativeFilePath,
                            fileLines,
                            fullFilePath: `/${path}`,
                        });
                    }
                    catch (error) {
                        // Terminate silently upon encountering non-text (binary) files.
                        resolve(undefined);
                    }
                }));
            });
            // Get files contents.
            const filesAndContent = await Promise.all(contentGetters);
            // Format to expected out format.
            filesAndContent.forEach((fileContents) => {
                if (fileContents) {
                    const { fileLines, relativeFilePath } = fileContents;
                    result.push({
                        filePath: relativeFilePath,
                        fileName: (0, utils_1.filenameFromPath)(relativeFilePath),
                        fullFilePath: fileContents.fullFilePath,
                        changes: fileLines.map((line, i) => ({
                            content: line,
                            line: i,
                            type: "add",
                            isVisible: true,
                        })),
                    });
                }
            });
            return result;
        }
        catch (error) {
            throw error;
        }
    }
    isParseDiffChangeNormal(change) {
        return change.type === "normal";
    }
    isParseDiffChangeAdd(change) {
        return change.type === "add";
    }
    isParseDiffChangeDelete(change) {
        return change.type === "del";
    }
}
exports["default"] = GitApi;


/***/ }),
/* 3 */
/***/ ((module) => {

function _createForOfIteratorHelper(o,allowArrayLike){var it=typeof Symbol!=="undefined"&&o[Symbol.iterator]||o["@@iterator"];if(!it){if(Array.isArray(o)||(it=_unsupportedIterableToArray(o))||allowArrayLike&&o&&typeof o.length==="number"){if(it)o=it;var i=0;var F=function F(){};return{s:F,n:function n(){if(i>=o.length)return{done:true};return{done:false,value:o[i++]}},e:function e(_e2){throw _e2},f:F}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}var normalCompletion=true,didErr=false,err;return{s:function s(){it=it.call(o)},n:function n(){var step=it.next();normalCompletion=step.done;return step},e:function e(_e3){didErr=true;err=_e3},f:function f(){try{if(!normalCompletion&&it["return"]!=null)it["return"]()}finally{if(didErr)throw err}}}}function _defineProperty(obj,key,value){if(key in obj){Object.defineProperty(obj,key,{value:value,enumerable:true,configurable:true,writable:true})}else{obj[key]=value}return obj}function _slicedToArray(arr,i){return _arrayWithHoles(arr)||_iterableToArrayLimit(arr,i)||_unsupportedIterableToArray(arr,i)||_nonIterableRest()}function _nonIterableRest(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function _unsupportedIterableToArray(o,minLen){if(!o)return;if(typeof o==="string")return _arrayLikeToArray(o,minLen);var n=Object.prototype.toString.call(o).slice(8,-1);if(n==="Object"&&o.constructor)n=o.constructor.name;if(n==="Map"||n==="Set")return Array.from(o);if(n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))return _arrayLikeToArray(o,minLen)}function _arrayLikeToArray(arr,len){if(len==null||len>arr.length)len=arr.length;for(var i=0,arr2=new Array(len);i<len;i++){arr2[i]=arr[i]}return arr2}function _iterableToArrayLimit(arr,i){var _i=arr==null?null:typeof Symbol!=="undefined"&&arr[Symbol.iterator]||arr["@@iterator"];if(_i==null)return;var _arr=[];var _n=true;var _d=false;var _s,_e;try{for(_i=_i.call(arr);!(_n=(_s=_i.next()).done);_n=true){_arr.push(_s.value);if(i&&_arr.length===i)break}}catch(err){_d=true;_e=err}finally{try{if(!_n&&_i["return"]!=null)_i["return"]()}finally{if(_d)throw _e}}return _arr}function _arrayWithHoles(arr){if(Array.isArray(arr))return arr}module.exports=function(input){if(!input)return[];if(typeof input!=="string"||input.match(/^\s+$/))return[];var lines=input.split("\n");if(lines.length===0)return[];var files=[];var currentFile=null;var currentChunk=null;var deletedLineCounter=0;var addedLineCounter=0;var currentFileChanges=null;var normal=function normal(line){var _currentChunk;(_currentChunk=currentChunk)===null||_currentChunk===void 0?void 0:_currentChunk.changes.push({type:"normal",normal:true,ln1:deletedLineCounter++,ln2:addedLineCounter++,content:line});currentFileChanges.oldLines--;currentFileChanges.newLines--};var start=function start(line){var _parseFiles;var _ref=(_parseFiles=parseFiles(line))!==null&&_parseFiles!==void 0?_parseFiles:[],_ref2=_slicedToArray(_ref,2),fromFileName=_ref2[0],toFileName=_ref2[1];currentFile={chunks:[],deletions:0,additions:0,from:fromFileName,to:toFileName};files.push(currentFile)};var restart=function restart(){if(!currentFile||currentFile.chunks.length)start()};var newFile=function newFile(){restart();currentFile["new"]=true;currentFile.from="/dev/null"};var deletedFile=function deletedFile(){restart();currentFile.deleted=true;currentFile.to="/dev/null"};var index=function index(line){restart();currentFile.index=line.split(" ").slice(1)};var fromFile=function fromFile(line){restart();currentFile.from=parseOldOrNewFile(line)};var toFile=function toFile(line){restart();currentFile.to=parseOldOrNewFile(line)};var toNumOfLines=function toNumOfLines(number){return+(number||1)};var chunk=function chunk(line,match){if(!currentFile)return;var _match$slice=match.slice(1),_match$slice2=_slicedToArray(_match$slice,4),oldStart=_match$slice2[0],oldNumLines=_match$slice2[1],newStart=_match$slice2[2],newNumLines=_match$slice2[3];deletedLineCounter=+oldStart;addedLineCounter=+newStart;currentChunk={content:line,changes:[],oldStart:+oldStart,oldLines:toNumOfLines(oldNumLines),newStart:+newStart,newLines:toNumOfLines(newNumLines)};currentFileChanges={oldLines:toNumOfLines(oldNumLines),newLines:toNumOfLines(newNumLines)};currentFile.chunks.push(currentChunk)};var del=function del(line){if(!currentChunk)return;currentChunk.changes.push({type:"del",del:true,ln:deletedLineCounter++,content:line});currentFile.deletions++;currentFileChanges.oldLines--};var add=function add(line){if(!currentChunk)return;currentChunk.changes.push({type:"add",add:true,ln:addedLineCounter++,content:line});currentFile.additions++;currentFileChanges.newLines--};var eof=function eof(line){var _currentChunk$changes3;if(!currentChunk)return;var _currentChunk$changes=currentChunk.changes.slice(-1),_currentChunk$changes2=_slicedToArray(_currentChunk$changes,1),mostRecentChange=_currentChunk$changes2[0];currentChunk.changes.push((_currentChunk$changes3={type:mostRecentChange.type},_defineProperty(_currentChunk$changes3,mostRecentChange.type,true),_defineProperty(_currentChunk$changes3,"ln1",mostRecentChange.ln1),_defineProperty(_currentChunk$changes3,"ln2",mostRecentChange.ln2),_defineProperty(_currentChunk$changes3,"ln",mostRecentChange.ln),_defineProperty(_currentChunk$changes3,"content",line),_currentChunk$changes3))};var schemaHeaders=[[/^diff\s/,start],[/^new file mode \d+$/,newFile],[/^deleted file mode \d+$/,deletedFile],[/^index\s[\da-zA-Z]+\.\.[\da-zA-Z]+(\s(\d+))?$/,index],[/^---\s/,fromFile],[/^\+\+\+\s/,toFile],[/^@@\s+-(\d+),?(\d+)?\s+\+(\d+),?(\d+)?\s@@/,chunk],[/^\\ No newline at end of file$/,eof]];var schemaContent=[[/^-/,del],[/^\+/,add],[/^\s+/,normal]];var parseContentLine=function parseContentLine(line){var _iterator=_createForOfIteratorHelper(schemaContent),_step;try{for(_iterator.s();!(_step=_iterator.n()).done;){var _step$value=_slicedToArray(_step.value,2),pattern=_step$value[0],handler=_step$value[1];var match=line.match(pattern);if(match){handler(line,match);break}}}catch(err){_iterator.e(err)}finally{_iterator.f()}if(currentFileChanges.oldLines===0&&currentFileChanges.newLines===0){currentFileChanges=null}};var parseHeaderLine=function parseHeaderLine(line){var _iterator2=_createForOfIteratorHelper(schemaHeaders),_step2;try{for(_iterator2.s();!(_step2=_iterator2.n()).done;){var _step2$value=_slicedToArray(_step2.value,2),pattern=_step2$value[0],handler=_step2$value[1];var match=line.match(pattern);if(match){handler(line,match);break}}}catch(err){_iterator2.e(err)}finally{_iterator2.f()}};var parseLine=function parseLine(line){if(currentFileChanges){parseContentLine(line)}else{parseHeaderLine(line)}return};var _iterator3=_createForOfIteratorHelper(lines),_step3;try{for(_iterator3.s();!(_step3=_iterator3.n()).done;){var line=_step3.value;parseLine(line)}}catch(err){_iterator3.e(err)}finally{_iterator3.f()}return files};var fileNameDiffRegex=/a\/.*(?=["']? ["']?b\/)|b\/.*$/g;var gitFileHeaderRegex=/^(a|b)\//;var parseFiles=function parseFiles(line){var fileNames=line===null||line===void 0?void 0:line.match(fileNameDiffRegex);return fileNames===null||fileNames===void 0?void 0:fileNames.map(function(fileName){return fileName.replace(gitFileHeaderRegex,"").replace(/("|')$/,"")})};var qoutedFileNameRegex=/^\\?['"]|\\?['"]$/g;var parseOldOrNewFile=function parseOldOrNewFile(line){var fileName=leftTrimChars(line,"-+").trim();fileName=removeTimeStamp(fileName);return fileName.replace(qoutedFileNameRegex,"").replace(gitFileHeaderRegex,"")};var leftTrimChars=function leftTrimChars(string,trimmingChars){string=makeString(string);if(!trimmingChars&&String.prototype.trimLeft)return string.trimLeft();var trimmingString=formTrimmingString(trimmingChars);return string.replace(new RegExp("^".concat(trimmingString,"+")),"")};var timeStampRegex=/\t.*|\d{4}-\d\d-\d\d\s\d\d:\d\d:\d\d(.\d+)?\s(\+|-)\d\d\d\d/;var removeTimeStamp=function removeTimeStamp(string){var timeStamp=timeStampRegex.exec(string);if(timeStamp){string=string.substring(0,timeStamp.index).trim()}return string};var formTrimmingString=function formTrimmingString(trimmingChars){if(trimmingChars===null||trimmingChars===undefined)return"\\s";else if(trimmingChars instanceof RegExp)return trimmingChars.source;return"[".concat(makeString(trimmingChars).replace(/([.*+?^=!:${}()|[\]/\\])/g,"\\$1"),"]")};var makeString=function makeString(itemToConvert){return(itemToConvert!==null&&itemToConvert!==void 0?itemToConvert:"")+""};


/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 5 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(6), exports);
__exportStar(__webpack_require__(9), exports);
__exportStar(__webpack_require__(11), exports);
__exportStar(__webpack_require__(13), exports);
__exportStar(__webpack_require__(15), exports);
__exportStar(__webpack_require__(17), exports);
__exportStar(__webpack_require__(19), exports);


/***/ }),
/* 6 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(7), exports);


/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.asyncExec = void 0;
const cp = __webpack_require__(8);
/**
 * Run command on a child process.
 */
const asyncExec = (command) => {
    return new Promise((resolve, reject) => {
        cp.exec(command.trim(), (error, stdout) => {
            if (error) {
                reject(error);
            }
            resolve(stdout);
        });
    });
};
exports.asyncExec = asyncExec;


/***/ }),
/* 8 */
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),
/* 9 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(10), exports);


/***/ }),
/* 10 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.filenameFromPath = void 0;
/**
 * Get filename and it's extension from full file path.
 */
const filenameFromPath = (path) => {
    // split by front/back slash.
    const pathParts = path.split(/[\/\\]/g);
    // Get last element, split by a dot.
    const fileName = pathParts[pathParts.length - 1];
    const fileNameSplitted = fileName.split(".");
    const numOfFilenameElements = fileNameSplitted.length;
    // Return name and extension.
    if (numOfFilenameElements === 1) {
        return {
            name: fileNameSplitted[0],
            extension: null,
        };
    }
    else {
        return {
            name: fileNameSplitted.slice(0, numOfFilenameElements - 1).join("."),
            extension: fileNameSplitted[numOfFilenameElements - 1],
        };
    }
};
exports.filenameFromPath = filenameFromPath;


/***/ }),
/* 11 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(12), exports);


/***/ }),
/* 12 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.myersDiff = void 0;
const curry_1 = __webpack_require__(13);
const print_operation = ({ content, operation_type, pos_end, pos_start, }) => {
    console.log(`{\n\tpos_start: ${pos_start}\n\tpos_end: ${pos_end}\n\toperation_type: ${operation_type}\n\tcontent: ${content}\n}\n`);
};
const get_CordsDiff = (a_cords, b_cords) => ({
    x_delta: Math.abs(a_cords[0] - b_cords[0]),
    y_delta: Math.abs(a_cords[1] - b_cords[1]),
});
/*
 * Example:
 * (7, 7) (7, 6) -> Insert
 * (7, 6) (6, 6) -> Delete
 */
const get_operation_between_cords = (a_cords, b_cords) => {
    let { x_delta, y_delta } = get_CordsDiff(a_cords, b_cords);
    if (y_delta > x_delta) {
        return "Insert";
    }
    else {
        return "Delete";
    }
};
const are_cords_non_negative = (cords) => cords[0] >= 0 && cords[1] >= 0;
/*
 * Check if first cord is smaller or equal.
 */
const is_smaller_or_eq = (a_cords, b_cords) => a_cords[0] <= b_cords[0] && a_cords[1] <= b_cords[1];
const did_point_exceed_strings = (s1, s2, cord) => {
    const len1 = s1.length;
    const len2 = s2.length;
    if (cord[0] > len1 || cord[1] > len2) {
        return true;
    }
    return false;
};
/*
 * Whether coordinates are an endpoint to a snake.
 */
const is_end_of_snake = (cords, snake_length, s1, s2) => {
    const [x, y] = cords;
    if (x <= 0 || y <= 0 || did_point_exceed_strings(s1, s2, cords)) {
        return false;
    }
    else {
        const aux = (s1_index, s2_index, acc) => {
            const are_equal = s1[s1_index] === s2[s2_index];
            if (are_equal === false || s1_index <= 0 || s2_index <= 0) {
                return are_equal ? acc + 1 : acc;
            }
            return aux(s1_index - 1, s2_index - 1, acc + 1);
        };
        return aux(x - 1, y - 1, 0) >= snake_length;
    }
};
/*
 * In edit graph, check whether it is possible to move from point A to point B given two strings where A > B. We move backward.
 *
 * It checks whether *one* step length in a certain direction is valid. E.g. it is not possible to make a move of length more than 1 if there is no diagnal.
 */
const is_step_distance_valid = (a_cords, b_cords, s1, s2) => {
    const [a_x, a_y] = a_cords;
    const [b_x, b_y] = b_cords;
    const d = get_CordsDiff(a_cords, b_cords);
    if (is_smaller_or_eq(b_cords, a_cords) === false) {
        return false;
    }
    else if ((d.x_delta === 1 && d.y_delta === 0) ||
        (d.x_delta === 0 && d.y_delta === 1)) {
        return true;
    }
    else if (d.y_delta === d.x_delta) {
        if (b_x === 0 && b_y === 0) {
            return s1.slice(0, a_x) === s2.slice(0, a_x);
        }
        else {
            return false;
        }
    }
    else {
        const diagonal_length = d.y_delta < d.x_delta ? d.y_delta : d.x_delta;
        return is_end_of_snake(a_cords, diagonal_length, s1, s2);
    }
};
const get_cords = (state, k_idx, k) => {
    const x = state[k_idx];
    const y = x - k;
    return [x, y];
};
const generate_list = (start, fin, step) => {
    const go = (start, fin, step, acc) => {
        if (start === fin) {
            return [...acc, start];
        }
        else {
            return go(start + step, fin, step, [...acc, start]);
        }
    };
    return go(start, fin, step, []);
};
const remove_N_first_chars_of_string = (str, n) => {
    return str.slice(n);
};
const remove_first_char_of_string = (str) => remove_N_first_chars_of_string(str, 1);
/*
 * Count equal characters at the beginning of each string.
 * eg. ('abc', 'abd') -> 2 ; ('abc', 'edf') -> 0
 */
const count_eq_chars = (s1, s2) => {
    const go = (s1, s2, acc) => {
        const l1 = s1.length;
        const l2 = s2.length;
        if (l1 === 0 || l2 === 0) {
            return acc;
        }
        else if (s1[0] === s2[0]) {
            return go(remove_first_char_of_string(s1), remove_first_char_of_string(s2), acc + 1);
        }
        else {
            return acc;
        }
    };
    return go(s1, s2, 0);
};
/*
 * Recover move from given position in a given direction of next V snapshot.
 */
const recover_single_move = (next_v_snapshot, str1, str2, current_cords, edit_graph, aux_function, history, is_out_of_bound, shifted_k, k) => {
    const len1 = str1.length;
    const len2 = str2.length;
    if (is_out_of_bound === false) {
        const next_cords = get_cords(next_v_snapshot, shifted_k, k);
        const [next_x, next_y] = next_cords;
        const can_travel = is_step_distance_valid(current_cords, next_cords, str1, str2);
        if (are_cords_non_negative(next_cords) === true &&
            can_travel === true &&
            next_x <= len1 &&
            next_y <= len2 &&
            is_smaller_or_eq(next_cords, current_cords) === true) {
            const operation_type = get_operation_between_cords(current_cords, next_cords);
            const start_position = operation_type === "Delete" ? next_x : next_y;
            const end_position = operation_type === "Delete" ? next_x + 1 : next_y + 1;
            const last_move = edit_graph.length >= 1 ? edit_graph[edit_graph.length - 1] : undefined;
            const should_concat = last_move !== undefined &&
                operation_type === last_move.operation_type &&
                last_move.pos_start === end_position;
            const this_move_content = operation_type === "Insert"
                ? str2[start_position]
                : str1[start_position];
            const move = {
                pos_start: start_position,
                pos_end: should_concat ? last_move.pos_end : end_position,
                operation_type: operation_type,
                content: should_concat
                    ? `${this_move_content}${last_move.content}`
                    : this_move_content,
            };
            const new_edit_graph = should_concat
                ? [...edit_graph.slice(0, -1), move]
                : [...edit_graph, move];
            const [_, ...rest_history] = history;
            return aux_function(rest_history, k, false, new_edit_graph);
        }
        else {
            return aux_function([], k, true, edit_graph);
        }
    }
    else {
        // If move impossible then don't continue this path.
        return aux_function([], k, true, edit_graph);
    }
};
/**
 * Not using Hunt & Szymanski LCS because R parameter is expected to be large (there would be a lot of matches between two strings)
 *
 *
 * @see(http://www.xmailserver.org/diff2.pdf) myers algo
 */
const myersDiff = (str1, str2) => {
    const len1 = str1.length;
    const len2 = str2.length;
    // Let 'nm' be the maximum number of moves in the edit graph.
    const nm = len1 + len2;
    const total_number_of_diagonals = nm * 2 + 1;
    // let 'v' be the array that holds reached depth (x axis) of particular k diagonal.
    // There is nm * 2 + 1 such diagonals starting from -nm to nm (including zero thus '+ 1').
    const v = Array(total_number_of_diagonals).fill(0);
    const is_out_of_bound = (x) => x < 0 || x > v.length - 1;
    // Make move given we're making Dth move and we have some state of moves basing on previous moves (v array).
    const make_move_on_ks = (diagonals, v, d, reached_NM) => {
        if (diagonals.length === 0) {
            return [v, reached_NM];
        }
        else {
            const [k, ...t] = diagonals;
            const shifted_k = k + nm; // Adjust to array indexing. Array indices cannot be negative.
            // Check whether to make a move.
            let updated_v = v; // For d = 0 do not move right or down. Just return current state.
            if (d > 0) {
                // Check whether to move down.
                const down = k === -d ||
                    (k !== -d &&
                        is_out_of_bound(shifted_k - 1) === false &&
                        is_out_of_bound(shifted_k + 1) === false &&
                        v[shifted_k - 1] < v[shifted_k + 1]);
                if (down) {
                    updated_v = v.map((a, i) => (i === shifted_k ? v[shifted_k + 1] : a));
                }
                else {
                    // Update k-diagonal depth for right move.
                    updated_v = v.map((a, i) => i === shifted_k ? v[shifted_k - 1] + 1 : a);
                }
            }
            // At this point we've made a move (or not). Let's check if it's possible to travel diagonal.
            const [x, y] = get_cords(updated_v, shifted_k, k);
            if (x + 1 <= len1 && y + 1 <= len2) {
                updated_v = updated_v.map((a, i) => {
                    if (i === shifted_k) {
                        return (a +
                            count_eq_chars(remove_N_first_chars_of_string(str1, x), remove_N_first_chars_of_string(str2, y)));
                    }
                    else {
                        return a;
                    }
                });
            }
            // Get (x, y) once more because it could have been changed by diagonal traversal.
            const [new_x, new_y] = get_cords(updated_v, shifted_k, k);
            // Check whether reached endpoint equals (N, M) final endpoint (end of the edit graph).
            if (new_x === len1 && new_y === len2) {
                return make_move_on_ks([], updated_v, d, true);
            }
            else {
                return make_move_on_ks(t, updated_v, d, false);
            }
        }
    };
    /*
          Take number of possible moves for given strings and produce array of moves history.
          Each history array item holds an array of x values for each k-diagonal where X value means furthest possible position of k-diagonal on X axis in edit graph during Dth move.
          This array of k-diagonal states facilitates recovering the shortest path from (N, M) to (0,0).
      */
    const traverse_edit_graph = (moves, history) => {
        const go = (dth_move, history) => {
            // Result of previous move.
            const previous_v_snapshot = history[history.length - 1];
            if (dth_move > moves) {
                return history;
            }
            else {
                const [new_v, reached_NM] = make_move_on_ks(generate_list(dth_move * -1, dth_move, 2), previous_v_snapshot, dth_move, false);
                const new_history = [...history, new_v];
                if (reached_NM === true) {
                    // If (N, M) was reached then stop computation for bigger ds.
                    return go(moves + 1, new_history);
                }
                else {
                    return go(dth_move + 1, new_history);
                }
            }
        };
        return go(0, history);
    };
    // Basing on list of snapshots of v-array (obtained in traverse_edit_graph) create an optimal edit script.
    const recover_edit_script = (history) => {
        const aux = (history, current_k_diag, invalid_path, edit_graph) => {
            const shifted_k = current_k_diag + nm; // Adjust to array indexing. Array indices cannot be negative.
            const history_len = history.length;
            if (history_len <= 1) {
                return {
                    operations: edit_graph,
                    is_invalid_path: invalid_path,
                };
            }
            else {
                const v_snapshot = history[0]; // Pop snapshot from "stack".
                const [x, y] = get_cords(v_snapshot, shifted_k, current_k_diag); // Current position.
                // If current position is (0, 0) then end the algorithm, we've reached the beginning of the edit script.
                if (x === 0 && y === 0) {
                    return {
                        operations: edit_graph,
                        is_invalid_path: false,
                    };
                }
                const shifted_k_left = shifted_k - 1;
                const shifted_k_right = shifted_k + 1;
                const is_left_move_out_of_bound = is_out_of_bound(shifted_k_left);
                const is_right_move_out_of_bound = is_out_of_bound(shifted_k_right);
                const next_v_snapshot = history[1];
                // Get state of current k diagonal in a previous move and check whether there is a diagonal on edit graph beginning.
                // Sometimes, when edit graph starts with a diagonal, it is vital to move downward in order to finish algorith run.
                const bottom_cords = get_cords(next_v_snapshot, shifted_k, shifted_k - nm);
                if (bottom_cords[0] === 0 &&
                    bottom_cords[1] === 0 &&
                    is_step_distance_valid([x, y], bottom_cords, str1, str2)) {
                    return {
                        operations: edit_graph,
                        is_invalid_path: false,
                    };
                }
                const curried_recover_single_move = (0, curry_1.curry)(recover_single_move);
                const prepared_recover_single_move = curried_recover_single_move(next_v_snapshot, str1, str2, [x, y], edit_graph, aux, history);
                // Take next possible moves for left and right.
                const left_path = prepared_recover_single_move(is_left_move_out_of_bound, shifted_k_left, shifted_k_left - nm);
                const right_path = prepared_recover_single_move(is_right_move_out_of_bound, shifted_k_right, shifted_k_right - nm);
                // Choose path. Favour shorter paths and those with more deletions.
                const left_length = left_path.operations.length;
                const right_length = right_path.operations.length;
                if (left_path.is_invalid_path === true) {
                    return right_path;
                }
                else if (right_path.is_invalid_path === true) {
                    return left_path;
                }
                else {
                    if (left_length >= right_length) {
                        return right_path;
                    }
                    else {
                        return left_path;
                    }
                }
            }
        };
        return aux(history, len1 - len2, false, []);
    };
    const history = traverse_edit_graph(nm, [v]);
    const edit_script = recover_edit_script(history.reverse());
    return edit_script;
};
exports.myersDiff = myersDiff;


/***/ }),
/* 13 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(14), exports);


/***/ }),
/* 14 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.curry = void 0;
const curry = (fn) => {
    const go = (...args) => {
        if (args.length >= fn.length) {
            return fn(...args);
        }
        else {
            return (...new_args) => go(...[...args, ...new_args]);
        }
    };
    return go;
};
exports.curry = curry;


/***/ }),
/* 15 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(16), exports);


/***/ }),
/* 16 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.findRepositories = void 0;
const vscode = __webpack_require__(1);
const matchFiles_1 = __webpack_require__(17);
const findRepositories = async (root, gitApi, ignoredDirectories) => {
    vscode.workspace.fs.readDirectory(root);
    const gitRepositoryDirectories = await (0, matchFiles_1.matchFiles)(root, ([_, filePath]) => gitApi.getRepository(filePath) !== null, ([filename]) => ignoredDirectories === undefined || !ignoredDirectories.includes(filename));
    return gitRepositoryDirectories.reduce((acc, x) => {
        return {
            ...acc,
            [x.path]: gitApi.getRepository(x),
        };
    }, {});
};
exports.findRepositories = findRepositories;


/***/ }),
/* 17 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(18), exports);


/***/ }),
/* 18 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.matchFiles = void 0;
const vscode = __webpack_require__(1);
/**
 * Starting from root Uri (which should be a directory) and traversing down the
 * directory tree return such Uris sequence that every file identified by this
 * sequence's uri passes given predicate and qualification function.
 *
 * Furthermore the function stops directory traversal on a given node when that node
 * passes a predicate.
 */
const matchFiles = async (root, predicate, qualify) => {
    const go = async (root) => {
        const files = await vscode.workspace.fs.readDirectory(root);
        const results = await Promise.all(files.map(async ([filename, fileType]) => new Promise((resolve) => {
            const fileUri = vscode.Uri.from({
                scheme: "file",
                path: `${root.path}/${filename}`,
            });
            const fileWithFullPath = [
                filename,
                fileUri,
                fileType,
            ];
            if (qualify === undefined || qualify(fileWithFullPath)) {
                if (predicate(fileWithFullPath)) {
                    resolve([fileUri]);
                    return;
                }
                // If it is not a directory then there is no way to go deeper.
                if (fileType !== vscode.FileType.Directory) {
                    resolve([]);
                    return;
                }
                go(fileUri).then(resolve);
            }
            resolve([]);
        })));
        return results.flat();
    };
    return await go(root);
};
exports.matchFiles = matchFiles;


/***/ }),
/* 19 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(20), exports);


/***/ }),
/* 20 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.stringToRegExp = void 0;
const stringToRegExp = (s) => {
    try {
        return {
            isInputBadExpression: false,
            regexp: new RegExp(s ?? ""),
        };
    }
    catch (error) {
        return {
            isInputBadExpression: true,
        };
    }
};
exports.stringToRegExp = stringToRegExp;


/***/ }),
/* 21 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(22), exports);


/***/ }),
/* 22 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(23), exports);
__exportStar(__webpack_require__(24), exports);


/***/ }),
/* 23 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ActivityBarViewProvider = void 0;
const _1 = __webpack_require__(22);
/**
 * Class responsible for resolving vdr-activity-bar-view WebviewView.
 */
class ActivityBarViewProvider {
    constructor(extensionContext) {
        this._extensionContext = extensionContext;
    }
    resolveWebviewView(webviewView) {
        this._ActibityBarView = new _1.ActivityBarView(this._extensionContext, webviewView);
    }
    /************
     *  Public  *
     ************/
    static getViewId() {
        return this._viewId;
    }
}
exports.ActivityBarViewProvider = ActivityBarViewProvider;
ActivityBarViewProvider._viewId = "vdr-activity-bar-view";


/***/ }),
/* 24 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ActivityBarView = void 0;
const vscode = __webpack_require__(1);
const gitExtensionApi_1 = __webpack_require__(2);
const Helpers_1 = __webpack_require__(25);
const types_1 = __webpack_require__(28);
const utils_1 = __webpack_require__(5);
var RENDER_STATE;
(function (RENDER_STATE) {
    RENDER_STATE[RENDER_STATE["VIEW_LOADING"] = 0] = "VIEW_LOADING";
    RENDER_STATE[RENDER_STATE["VIEW_READY"] = 1] = "VIEW_READY";
    RENDER_STATE[RENDER_STATE["NO_REPO"] = 2] = "NO_REPO";
})(RENDER_STATE || (RENDER_STATE = {}));
/**
 * Class responsible for managing vdr-activity-bar-view WebviewView.
 */
class ActivityBarView {
    constructor(extensionContext, webviewView) {
        this._renderState = RENDER_STATE.VIEW_LOADING;
        this._disposables = [];
        this._gitApi = gitExtensionApi_1.default.Instance;
        this._textEditorsDecorations = [];
        this._loadingState = {
            gitRepositories: true,
        };
        this._abortQueueOfGetAndApplyChanges = [];
        this._updateAbortQueueOfGetAndApplyChanges = () => {
            // Stop and remove all ongoing signals
            this._abortQueueOfGetAndApplyChanges.forEach((a) => a.abort());
            this._abortQueueOfGetAndApplyChanges = []; // I have no idea how to do this without mutating global state.
            // Create new signal.
            const ac = new AbortController();
            this._abortQueueOfGetAndApplyChanges.push(ac);
            return ac.signal;
        };
        this._extensionContext = extensionContext;
        this._view = webviewView;
        this._WebviewUriProvider = new Helpers_1.WebviewUriProvider(this._view.webview, this._extensionContext.extensionUri);
        this._view.webview.options = this._getWebviewOptions(); // Configure Webview.
        // Listen for messages within the View.
        this._setWebviewMessageListener();
        // Listen for text document save.
        vscode.workspace.onDidSaveTextDocument(async (ctx) => {
            // Apply changes when user saves a project file only.
            if (ctx.uri.scheme === "file") {
                await this._getAndApplyChanges(this._updateAbortQueueOfGetAndApplyChanges());
            }
        }, undefined, this._disposables);
        vscode.workspace.onDidChangeTextDocument(async () => {
            this._paintDecorationsInTextEditors(this._getTermPositionsInChangesFromState);
        }, undefined, this._disposables);
        vscode.window.onDidChangeVisibleTextEditors(async () => {
            /*
            Works for:
              [X] Listen for new tab open.
              [X] Repaint searched term decorations.
              [X] Check if it works for re-opening closed tabs
              [X] Check if it works po splitting into new tab.
          */
            this._paintDecorationsInTextEditors(this._getTermPositionsInChangesFromState);
        }, undefined, this._disposables);
        // Clean disposables.
        this._view.onDidDispose(this.dispose, undefined, this._disposables);
        if (this._gitApi.getState === "initialized") {
            this._handleGitApiInitialized();
        }
        else {
            this._gitApi.onDidChangeState((e) => {
                if (e === "initialized") {
                    this._handleGitApiInitialized();
                }
            });
        }
        this._renderView();
    }
    dispose() {
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    /*************
     *  Private  *
     *************/
    _getWebviewOptions() {
        return {
            enableScripts: true, // For UI Toolkit
        };
    }
    /**
     * Update variable that holds informations about this view's components loading
     * state.
     * If all components did load then change render state to "ready to render".
     * Next render state (final one) will further handle loading.
     *
     */
    _updateLoadingState(key, value) {
        this._loadingState[key] = value;
        let isLoading = false;
        for (const key in this._loadingState) {
            const element = this._loadingState[key];
            if (element === true) {
                isLoading = true;
            }
        }
        if (isLoading === false) {
            this._renderState = RENDER_STATE.VIEW_READY;
        }
    }
    /**
     * Listen for events coming from this activity bar's webview.
     */
    _setWebviewMessageListener() {
        let inputChangeWasNoted = false;
        // Webview messages.
        this._view.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.command) {
                case "searchInputChange":
                    const { value } = msg;
                    this._handleSearchInputChange(value, !inputChangeWasNoted);
                    inputChangeWasNoted = true;
                    break;
                case "ActivityBarViewDidLoad":
                    const searchedTerm = this._getSearchInputFromState;
                    this._postSearchInputValueToWebview(searchedTerm);
                    break;
                case "changeClick":
                    const { fullFilePath, change } = msg;
                    await this._handleChangeClick(fullFilePath, change);
                    break;
                case "log":
                    console.log(msg.value);
                    break;
                default:
                    break;
            }
        }, undefined, this._disposables);
    }
    _getValueFromState(key) {
        const { workspaceState } = this._extensionContext;
        const value = workspaceState.get(key);
        if (!value) {
            return null;
        }
        return value;
    }
    get _getSearchInputFromState() {
        return this._getValueFromState(types_1.WorkspaceStateKeys.ABV_SEARCH_INPUT);
    }
    get _getTermPositionsInChangesFromState() {
        const positions = this._getValueFromState(types_1.WorkspaceStateKeys.ABV_CHANGES_TERM_POSITIONS);
        if (positions === null) {
            return {};
        }
        return JSON.parse(positions);
    }
    async _handleSearchInputChange(value, force = false) {
        const { workspaceState } = this._extensionContext;
        const currentValue = this._getSearchInputFromState;
        // Avoid unnecessary renders and updates
        if (value !== currentValue || force) {
            await workspaceState.update(types_1.WorkspaceStateKeys.ABV_SEARCH_INPUT, value);
        }
        // Always when input was changed apply new changes.
        await this._getAndApplyChanges(this._updateAbortQueueOfGetAndApplyChanges());
    }
    async _getAndApplyChanges(sig) {
        console.log(1);
        if (sig.aborted) {
            return;
        }
        // @TODO: Add signal abort to this function. This is pretty expensive function and its worth it to pass abort signal there (saving even 3 to 20 seconds)
        const changes = await this._getFilesChanges();
        console.log(2);
        if (sig.aborted) {
            return;
        }
        const [positions, repoChanges] = Object.entries(changes).reduce((acc, [repoPath, data]) => {
            return [
                {
                    ...acc[0],
                    ...data[0],
                },
                {
                    ...acc[1],
                    [repoPath]: data[1],
                },
            ];
        }, [{}, {}]);
        console.log(3);
        if (sig.aborted) {
            return;
        }
        this._postChangesToWebview(repoChanges);
        console.log(4);
        this._paintDecorationsInTextEditors(positions);
        await this._saveInStorage(types_1.WorkspaceStateKeys.ABV_CHANGES_TERM_POSITIONS, JSON.stringify(positions));
    }
    /**
     * Open text document in an editor.
     *
     * @param fullFilePath path pointing to clicked line of changed document
     * @param line number of line where change occured
     */
    async _handleChangeClick(fullFilePath, change) {
        try {
            const doc = await vscode.workspace.openTextDocument(fullFilePath);
            const editor = await vscode.window.showTextDocument(doc);
            // Center at the position of the change.
            editor.revealRange(new vscode.Range(new vscode.Position(change.line, 0), new vscode.Position(change.line, 0)), vscode.TextEditorRevealType.InCenter);
        }
        catch (error) {
            console.log(error);
        }
    }
    async _handleGitApiInitialized() {
        const repositories = await this._gitApi.getWorkspaceRepositories();
        if (repositories && Object.entries(repositories).length > 0) {
            this._updateLoadingState("gitRepositories", false);
        }
        else {
            this._renderState = RENDER_STATE.NO_REPO;
        }
        this._renderView();
    }
    _postSearchInputValueToWebview(term) {
        // Load search input content.
        this._view.webview.postMessage({
            command: "setSearchInputValue",
            value: term ?? "",
        });
    }
    _postChangesToWebview(changes) {
        this._view.webview.postMessage({
            command: "newResults",
            matches: changes,
        });
    }
    async _saveInStorage(key, value) {
        const { workspaceState } = this._extensionContext;
        await workspaceState.update(key, value);
    }
    _getEditorPositionsFromFilenameLineChangeHashMap({ changesHashMap, searchedTerm, onLineChangeEncountered, }) {
        console.log('hi');
        const results = {};
        for (const fileName in changesHashMap) {
            results[fileName] = {}; // Prepare hash map for given file.
            const changes = changesHashMap[fileName];
            // @NOTE: This part is slow.
            // It is worth to send `changes` object to a separate job and split the computation between multiple threads (using Node's Worked Threads)
            for (const changeLineNumber in changes) {
                /*
                  This loop is only concerned with changes within a single line. Thus we can conclude whether we're dealing with insertion or modification.
                */
                const changeLineNumberParsed = parseInt(changeLineNumber);
                const change = changes[changeLineNumber];
                let isModified = change.length === 2;
                let isPlainAdd = change.length === 1;
                let originalContent, currentContent;
                if (isPlainAdd) {
                    // Consider whole line as changed.
                    originalContent = "";
                    const changeUnit = change[0];
                    if (changeUnit.type !== "add") {
                        // Do not analyze deletions as a single unit. There is nothing to paint there.
                        continue;
                    }
                    currentContent = changeUnit.content;
                }
                else if (isModified) {
                    const addChangeIndex = change.findIndex((c) => c.type === "add");
                    const delChange = change[1 - addChangeIndex];
                    const addChange = change[addChangeIndex];
                    originalContent = delChange.content;
                    currentContent = addChange.content;
                }
                else {
                    // Don't paint changes. Change at line shouldn't be longer than 2.
                    continue;
                }
                console.log('x');
                console.log({ originalContent,
                    currentContent });
                try {
                    (0, utils_1.myersDiff)(originalContent, currentContent);
                    console.log(1);
                }
                catch (error) {
                    console.log(2);
                    console.log(error);
                }
                const originalToCurrentEditScript = (0, utils_1.myersDiff)(originalContent, currentContent);
                console.log('d', { originalToCurrentEditScript });
                let termFoundInChanges = false;
                originalToCurrentEditScript.operations.forEach(async (operation) => {
                    // Use only adds.
                    if (operation.operation_type !== "Insert") {
                        return;
                    }
                    // Find terms in edit script.
                    const foundTerms = [
                        ...operation.content.matchAll(new RegExp(searchedTerm, "g")),
                    ];
                    if (foundTerms && foundTerms.length > 0) {
                        termFoundInChanges = true;
                        foundTerms.forEach((match) => {
                            if (match.index === undefined) {
                                return;
                            }
                            // Find terms in edit script and Extract positions.
                            const positionToPaint = {
                                content: currentContent,
                                posStart: match.index + operation.pos_start,
                                posEnd: match.index + operation.pos_start + match[0].length,
                            };
                            if (results[fileName][changeLineNumber] === undefined) {
                                results[fileName][changeLineNumber] = [positionToPaint];
                            }
                            else {
                                results[fileName][changeLineNumber].push(positionToPaint);
                            }
                        });
                    }
                });
                console.log('c');
                if (onLineChangeEncountered) {
                    onLineChangeEncountered({
                        didMatch: termFoundInChanges,
                        fileName: fileName,
                        line: changeLineNumberParsed,
                    });
                }
            }
        }
        console.log('bye');
        return results;
    }
    /**
     * Inpure function that communicates with active text editors and paints
     * decorations on given positions.
     *
     */
    _paintDecorationsInTextEditors(positions) {
        try {
            // Dispose and clear decorations from previous render.
            this._textEditorsDecorations.forEach((decoration) => decoration.dispose());
            this._textEditorsDecorations = [];
            for (const filePath in positions) {
                // Find editors with this file.
                const editors = vscode.window.visibleTextEditors.filter((e) => e.document.uri.path.toLocaleLowerCase() ===
                    filePath.toLocaleLowerCase());
                if (!editors || editors.length === 0) {
                    continue;
                }
                for (const fileLine in positions[filePath]) {
                    const positionChange = positions[filePath][fileLine];
                    const parsedFileLine = parseInt(fileLine);
                    // Create decoration.
                    const decoration = vscode.window.createTextEditorDecorationType({
                        backgroundColor: Helpers_1.ExtensionConfiguration.getKey(types_1.ConfigurationKeys.MATCH_BACKGROUND_COLOR) ?? "green",
                        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
                    });
                    this._textEditorsDecorations.push(decoration);
                    editors.forEach((editor) => {
                        const editorLine = editor.document.lineAt(parsedFileLine);
                        const ranges = [];
                        positionChange.forEach((change) => {
                            /*
                            Check whether current content of the document at changed line is equal to passed change position content.
                            We do this to prevent painting decoration that are irrelevant.
                          */
                            const getChangeContentAtPosition = (s) => s.slice(change.posStart, change.posEnd);
                            const changeChunkAlone = getChangeContentAtPosition(change.content);
                            const editorChunkAlone = getChangeContentAtPosition(editorLine.text);
                            if (changeChunkAlone === editorChunkAlone) {
                                ranges.push(new vscode.Range(new vscode.Position(parsedFileLine, change.posStart), new vscode.Position(parsedFileLine, change.posEnd)));
                            }
                        });
                        editor.setDecorations(decoration, ranges);
                    });
                }
            }
        }
        catch (error) {
            console.log(error);
        }
    }
    /**
     * Function that should be run on file content changes or searched term changes.
     * Analyzes `git diff`, filters by current regex search.
     *
     */
    async _getFilesChanges() {
        const searchInputValue = this._getSearchInputFromState;
        if (searchInputValue === null || searchInputValue.length === 0) {
            return {};
        }
        /*
          -----              -----
          -- PARSING SUBROUTINE --
          -----              -----
    
          It will parse "git diff" command and put it into easy-to-interpret (for this special case) objects.
    
          Whole process consists of several steps.
          * Parse "git diff" (text -> array of javascript objects)
          * Filter only "add" and "delete" changes. Also index changes by file path and line numbers.
          * Now, first phase of parsing is done. We have javascript objects that facilitate further manipulations.
        */
        // Run and parse `git diff`.
        const diffs = await this._gitApi.parseDiffs();
        const regexpParseResult = (0, utils_1.stringToRegExp)(searchInputValue);
        if (regexpParseResult.isInputBadExpression === true) {
            return {};
        }
        const positionsAndChanges = await Promise.all(Object.keys(diffs).map((repoPath) => new Promise(async (resolve) => {
            const diff = diffs[repoPath];
            // Filter with saved regex term.
            const filteredChanges = [];
            // Contains filtered changes (File name -> change line -> change) hash map. Index to process changes within a single line easier.
            const filteredChangesHashMap = {};
            diff.forEach((changedFile) => {
                let newIndex = undefined;
                changedFile.changes.forEach((fileChange) => {
                    /*
                      @NOTE: in future make it a changeable option. This is possible that someone will want to use regexp in context of whole line.
                      Also @NOTE that letting all lines in may introduce some computation overhead, monitor this part of the code when some performance problems arise in the future.
                    */
                    if (fileChange.type === "add" || fileChange.type === "del") {
                        // Create different object types for changed files. Later it will be easier to reason about this changed files.
                        if (newIndex === undefined) {
                            // First change in a file matched.
                            newIndex =
                                filteredChanges.push({
                                    filePath: changedFile.filePath,
                                    fileName: changedFile.fileName,
                                    fullFilePath: changedFile.fullFilePath,
                                    changes: [fileChange],
                                }) - 1;
                        }
                        else {
                            // Rest of the changes matched in a file.
                            filteredChanges[newIndex].changes.push(fileChange);
                        }
                        // Index (aggregation) per changed file per line.
                        if (!filteredChangesHashMap[changedFile.fullFilePath]) {
                            filteredChangesHashMap[changedFile.fullFilePath] = {};
                        }
                        if (!filteredChangesHashMap[changedFile.fullFilePath][fileChange.line]) {
                            filteredChangesHashMap[changedFile.fullFilePath][fileChange.line] = [];
                        }
                        filteredChangesHashMap[changedFile.fullFilePath][fileChange.line].push(fileChange);
                    }
                });
            });
            /*
              -----                           -----
              -- EXTRACTING POSITIONS SUBROUTINE --
              -----                           -----
        
              It will extract specific changed positions that match searched term and further filter changes by this term.
        
              * First of all we need to make sure that lines that doesn't contain searched term strictly in *changes* (meaning changed indexes of a string) will be eventually filtered out (filter lines that contain searched term but not in changes). See `changedLinesThatDidntMatchTerm` dictionary.
              * Find added positions in changed lines.
            */
            // Collect positions where searched term occur.
            const changedLinesThatDidntMatchTerm = {};
            const editorPositionsFromFilenameLineChangeHashMap = this._getEditorPositionsFromFilenameLineChangeHashMap({
                changesHashMap: filteredChangesHashMap,
                searchedTerm: regexpParseResult.regexp,
                // Find changes that don't match searched term.
                onLineChangeEncountered: ({ didMatch, fileName, line }) => {
                    if (didMatch) {
                        return;
                    }
                    if (!changedLinesThatDidntMatchTerm[fileName]) {
                        changedLinesThatDidntMatchTerm[fileName] = [];
                    }
                    changedLinesThatDidntMatchTerm[fileName].push(line);
                },
            });
            // Second (and final) step of filtering where we filter lines that don't contain searched term in changes (but it may contain the term in the rest of the line contents).
            const fullyFilteredChanges = filteredChanges
                .map((fileChange) => {
                const linesToRemove = changedLinesThatDidntMatchTerm[fileChange.fullFilePath];
                if (!linesToRemove ||
                    !Array.isArray(linesToRemove) ||
                    linesToRemove.length === 0) {
                    return fileChange;
                }
                const updatedFileChange = {
                    ...fileChange,
                };
                updatedFileChange.changes = fileChange.changes.filter((change) => !linesToRemove.includes(change.line));
                return updatedFileChange;
            })
                .filter((fileChange) => fileChange.changes.length > 0);
            resolve({
                [repoPath]: [
                    editorPositionsFromFilenameLineChangeHashMap,
                    fullyFilteredChanges,
                ],
            });
        })));
        return positionsAndChanges.reduce((acc, x) => ({
            ...acc,
            ...x,
        }), {});
    }
    /**
     * Generate Webview HTML basing on current View state.
     */
    _buildView() {
        switch (this._renderState) {
            case RENDER_STATE.VIEW_LOADING:
                return `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width,initial-scale=1.0">
                </head>
                <body>
                    Extension is loading...
                </body>
            </html>
        `;
                break;
            case RENDER_STATE.NO_REPO:
                return `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width,initial-scale=1.0">
                </head>
                <body>
                    It looks like you don't have any repositories inside opened directory.
                </body>
            </html>
        `;
                break;
            case RENDER_STATE.VIEW_READY:
                return `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width,initial-scale=1.0">
                    <script type="module" src="${this._WebviewUriProvider.getUiToolkitWebviewUri()}"></script>
                    <script type="module" src="${this._WebviewUriProvider.getRedomWebviewUri()}"></script>
                    <script type="module" src="${this._WebviewUriProvider.getFileIconsJsWebviewUri()}"></script>
                    <script type="module" src="${this._WebviewUriProvider.getScriptWebviewUri(["ActivityBarScripts.js"])}"></script>
                    <link rel="stylesheet" href="${this._WebviewUriProvider.getFileIconsCssWebviewUri()}">
                    <link rel="stylesheet" href="${this._WebviewUriProvider.getStyleWebviewUri(["activity-bar-scripts.css"])}">
                </head>
                
                <body>
                    <vscode-text-field id="searchInput" placeholder='eg. ".*console.log.*"'>
                      Search
                    </vscode-text-field>
                    <div class="search-input-msg" id="emptySearchInput">Feel free to use above search input.</div>
                    <div class="search-input-msg" id="badSearchInput">Invalid regular expression. Please check your search term syntax.</div>
                    <div class="results-container" id="resultsContainer"></div>
                </body>
            </html>
        `;
                break;
            default:
                return `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width,initial-scale=1.0">
                </head>
                <body>
                    Extension didn't load correctly. Please try reloading VSC window.
                </body>
            </html>
        `;
                break;
        }
    }
    _renderView() {
        this._view.webview.html = this._buildView();
    }
}
exports.ActivityBarView = ActivityBarView;


/***/ }),
/* 25 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(26), exports);
__exportStar(__webpack_require__(27), exports);


/***/ }),
/* 26 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WebviewUriProvider = void 0;
const vscode = __webpack_require__(1);
/**
 * Helper for retrieving URLs to be used on a web views.
 */
class WebviewUriProvider {
    constructor(WebviewView, extenstionUri) {
        this._WebviewView = WebviewView;
        this._extenstionUri = extenstionUri;
    }
    /************
     *  Public  *
     ************/
    getUiToolkitWebviewUri() {
        return this._getWebviewUri([
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js",
        ]);
    }
    getRedomWebviewUri() {
        return this._getWebviewUri([
            "node_modules",
            "redom",
            "dist",
            "redom.min.js",
        ]);
    }
    getFileIconsJsWebviewUri() {
        return this._getWebviewUri([
            "node_modules",
            "file-icons-js",
            "dist",
            "file-icons.js",
        ]);
    }
    getFileIconsCssWebviewUri() {
        return this._getWebviewUri([
            "node_modules",
            "file-icons-js",
            "css",
            "style.css",
        ]);
    }
    getScriptWebviewUri(scriptPath) {
        return this._getWebviewUri(["media", "scripts", ...scriptPath]);
    }
    getStyleWebviewUri(scriptPath) {
        return this._getWebviewUri(["media", "styles", ...scriptPath]);
    }
    /*************
     *  Private  *
     *************/
    _getWebviewUri(modulePathList) {
        return this._WebviewView.asWebviewUri(vscode.Uri.joinPath(this._extenstionUri, ...modulePathList));
    }
}
exports.WebviewUriProvider = WebviewUriProvider;


/***/ }),
/* 27 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ExtensionConfiguration = void 0;
const vscode = __webpack_require__(1);
class ExtensionConfiguration {
    constructor() { }
    static getKey(key) {
        return vscode.workspace.getConfiguration("vsc-diff-regex").get(key) ?? null;
    }
}
exports.ExtensionConfiguration = ExtensionConfiguration;


/***/ }),
/* 28 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(29), exports);
__exportStar(__webpack_require__(30), exports);
__exportStar(__webpack_require__(31), exports);
__exportStar(__webpack_require__(32), exports);
__exportStar(__webpack_require__(35), exports);
__exportStar(__webpack_require__(36), exports);
__exportStar(__webpack_require__(37), exports);
__exportStar(__webpack_require__(38), exports);
__exportStar(__webpack_require__(39), exports);


/***/ }),
/* 29 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WorkspaceStateKeys = void 0;
var WorkspaceStateKeys;
(function (WorkspaceStateKeys) {
    WorkspaceStateKeys["ABV_SEARCH_INPUT"] = "ABV_SEARCH_INPUT";
    WorkspaceStateKeys["ABV_CHANGES_TERM_POSITIONS"] = "ABV_CHANGES_POSITIONS";
})(WorkspaceStateKeys = exports.WorkspaceStateKeys || (exports.WorkspaceStateKeys = {}));


/***/ }),
/* 30 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ }),
/* 31 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ }),
/* 32 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(33), exports);
__exportStar(__webpack_require__(34), exports);


/***/ }),
/* 33 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ }),
/* 34 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ }),
/* 35 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ }),
/* 36 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ }),
/* 37 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ }),
/* 38 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ConfigurationKeys = void 0;
var ConfigurationKeys;
(function (ConfigurationKeys) {
    ConfigurationKeys["MATCH_BACKGROUND_COLOR"] = "matchBackgroundColor";
})(ConfigurationKeys = exports.ConfigurationKeys || (exports.ConfigurationKeys = {}));


/***/ }),
/* 39 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deactivate = exports.activate = void 0;
const vscode = __webpack_require__(1);
const gitExtensionApi_1 = __webpack_require__(2);
const Views_1 = __webpack_require__(21);
async function activate(context) {
    console.log("*** vsc-diff-regex startup ***");
    /***********************
     *  Extension startup  *
     ***********************/
    const gitApi = gitExtensionApi_1.default.Instance;
    // Make sure git extension is active
    if (await gitApi.activateGit()) {
        try {
            // Check git configuration (due to parse limitations of "parse-diff": "^0.9.0")
            // @NOTE: remove in foreseeable future.
            // https://github.com/sergeyt/parse-diff/pull/44
            // const isDiffMnemonicPrefixEnabled = await asyncExec(
            //   "git config --global --list" // @TODO:
            // );
            // // const isDiffMnemonicPrefixEnabled = await asyncExec(
            // //   "git config --global diff.mnemonicprefix" // @TODO:
            // // );
            // // @TODO: handle empty
            // if (["true", ""].includes(isDiffMnemonicPrefixEnabled.trim())) {
            //   vscode.window.showWarningMessage(
            //     'Extension may not work correctly when diff.mnemonicPrefix equals true in your git configuration. Please run "git config --global diff.mnemonicPrefix false".'
            //   );
            // }
            context.subscriptions.push(vscode.window.registerWebviewViewProvider(Views_1.ActivityBarViewProvider.getViewId(), new Views_1.ActivityBarViewProvider(context)));
            // Test command
            let ping = vscode.commands.registerCommand("vdr.ping", () => {
                vscode.window.showInformationMessage("Pong");
            });
            context.subscriptions.push(ping);
        }
        catch (error) {
            console.log({ error });
        }
    }
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=extension.js.map