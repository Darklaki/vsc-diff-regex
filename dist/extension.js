const path = __webpack_require__(4);
const utils_1 = __webpack_require__(5);
        const cleanDelChange = !configExists ||
            (configExists &&
                (config.cleanDelChange === undefined ||
                    config.cleanDelChange === true));
            parsedDiff.diffs.forEach((file, i) => {
                                    line: change.ln - 1,
                                        // .replace(/^( |\t)*/g, "")
                                    isVisible: true,
                                    line: change.ln - 1,
                                    content: cleanDelChange
                                        ? change.content
                                            .replace(/^\-/g, "")
                                        // .replace(/^( |\t)*/g, "")
                                        : change.content,
                                    isVisible: false,
                                    line: change.ln1 - 1,
                                    isVisible: false,
                    fileName: (0, utils_1.filenameFromPath)(file.from),
                    fullFilePath: `${parsedDiff.repository.rootUri.path}/${file.from}`,
    repositoryExist() {
        return this.getWorkspaceMainRepository() !== null;
    }
    onDidOpenRepository(cb) {
        this._vscGitApi.onDidOpenRepository(cb);
    }
    onDidChangeState(cb) {
        this._vscGitApi.onDidChangeState(cb);
    }
    getState() {
        return this._vscGitApi.state;
    }
    /*************
     *  Private  *
     *************/
    /**
     * Get file diffs in workspace repositories.
     *
     */
            return {
                diffs: result,
                repository,
            };
                contentGetters.push(new Promise(async (resolve) => {
                            fullFilePath: `/${path}`,
                        // Terminate silently upon encountering non-text (binary) files.
                        fileName: (0, utils_1.filenameFromPath)(relativeFilePath),
                        fullFilePath: fileContents.fullFilePath,
                            isVisible: true,
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 5 */
__exportStar(__webpack_require__(6), exports);
__exportStar(__webpack_require__(9), exports);
__exportStar(__webpack_require__(11), exports);
/* 6 */
__exportStar(__webpack_require__(7), exports);
/* 7 */
const cp = __webpack_require__(8);
/**
 * Run command on a child process.
 */
/* 8 */
/* 9 */
__exportStar(__webpack_require__(10), exports);
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
__exportStar(__webpack_require__(12), exports);
/* 12 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.myersDiff = void 0;
const print_operation = ({ content, operation_type, pos_end, pos_start, }) => {
    console.log(`{\n\tpos_start: ${pos_start}\n\tpos_end: ${pos_end}\n\toperation_type: ${operation_type}\n\tcontent: ${content}\n}\n`);
};
const get_cords_diff = (a_cords, b_cords) => ({
    x_delta: Math.abs(a_cords[0] - b_cords[0]),
    y_delta: Math.abs(a_cords[1] - b_cords[1]),
});
/*
 * Example:
 * (7, 7) (7, 6) -> Insert
 * (7, 6) (6, 6) -> Delete
 */
const get_operation_between_cords = (a_cords, b_cords) => {
    let { x_delta, y_delta } = get_cords_diff(a_cords, b_cords);
    if (y_delta > x_delta) {
        return "Insert";
    }
    else {
        return "Delete";
    }
};
const are_cords_non_negative = (cords) => {
    if (cords[0] >= 0 && cords[1] >= 0) {
        return true;
    }
    return false;
};
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
                return acc;
            }
            return aux(s1_index - 1, s2_index - 1, acc + 1);
        };
        return aux(x - 1, y - 1, 0) === snake_length;
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
    const d = get_cords_diff(a_cords, b_cords);
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
                // Take next possible moves for left and right.
                const left_path = recover_single_move(next_v_snapshot, str1, str2, [x, y], edit_graph, aux, history, is_left_move_out_of_bound, shifted_k_left, shifted_k_left - nm);
                const right_path = recover_single_move(next_v_snapshot, str1, str2, [x, y], edit_graph, aux, history, is_right_move_out_of_bound, shifted_k_right, shifted_k_right - nm);
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
__exportStar(__webpack_require__(15), exports);
__exportStar(__webpack_require__(16), exports);


/***/ }),
/* 15 */
const _1 = __webpack_require__(14);
/* 16 */
const Helpers_1 = __webpack_require__(17);
const types_1 = __webpack_require__(19);
const utils_1 = __webpack_require__(5);
    RENDER_STATE[RENDER_STATE["NO_REPO"] = 2] = "NO_REPO";
        this._view.webview.options = this._getWebviewOptions(); // Configure Webview.
        const saveListener = vscode.workspace.onDidSaveTextDocument(async () => {
            await this._applyChanges();
        });
        // Changing tabs.
        const closeListener = vscode.workspace.onDidOpenTextDocument(async () => {
            // @TODO:
            // [X] Listen for new tab open.
            // [X] Repaint searched term decorations.
            // [ ] Check if it works for re-opening closed tabs
            // [ ] Check if it works po splitting into new tab.
        this._disposables.push(saveListener, closeListener);
        if (this._gitApi.getState() === "initialized") {
            this._handleGitApiInitialized();
        }
        else {
            this._gitApi.onDidChangeState((e) => {
                if (e === "initialized") {
                    this._handleGitApiInitialized();
                }
            });
        }
        let inputChangeWasNoted = false;
        this._view.webview.onDidReceiveMessage(async (msg) => {
                    this._handleSearchInputChange(value, !inputChangeWasNoted);
                    inputChangeWasNoted = true;
                case "changeClick":
                    const { fullFilePath, change } = msg;
                    await this._handleChangeClick(fullFilePath, change);
                    break;
                case "log":
                    console.log(msg.value);
                    break;
    async _handleSearchInputChange(value, force = false) {
        // @TODO: force should be made on every reload of this view (leaving the sidebar aswell)
        if (value !== currentValue || force) {
        }
        if (value && value.length !== 0) {
            // Always when input was changed, check for new search results.
    /**
     * Open text document in an editor.
     *
     * @param fullFilePath path pointing to clicked line of changed document
     * @param line number of line where change occured
     */
    async _handleChangeClick(fullFilePath, change) {
        // @TODO: catch statement
        const doc = await vscode.workspace.openTextDocument(`${fullFilePath}`);
        const editor = await vscode.window.showTextDocument(doc);
        // Center at the position of the change.
        editor.revealRange(new vscode.Range(new vscode.Position(change.line, 0), new vscode.Position(change.line, 0)), vscode.TextEditorRevealType.InCenter);
        // @TODO: move to painting subroutine
        // Highlight change occurances (using decorations).
        const decoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: "red",
        });
        editor.setDecorations(decoration, [
            new vscode.Range(new vscode.Position(20, 0), new vscode.Position(20, 40)),
        ]);
    }
    _handleGitApiInitialized() {
        // @TODO: [roadmap] consider multiple workspaces
        const repository = this._gitApi.getWorkspaceMainRepository();
        if (repository) {
            this._renderState = RENDER_STATE.VIEW_READY;
        }
        else {
            this._renderState = RENDER_STATE.NO_REPO;
        }
        this._renderView();
    }
        this._view.webview.postMessage({
            command: "setSearchInputValue",
            value: searchInputValue ?? "",
        });
     * regex search, repaints changes tree and decorated active editor.
        // If searched term does not exist then stop the routine.
        if (!searchInputValue ||
            typeof searchInputValue !== "string" ||
            searchInputValue.length === 0) {
            return;
        }
        /*
          -----
          -- PARSING SUBROUTINE
          -----
    
          It will parse "git diff" command and put it into easy-to-interpret (for this special case) objects.
    
          Whole process consists of several steps.
          * Parse "git diff" (text -> array of javascript objects)
          * Filter only "add" and "delete" changes. Also keep only these lines where searched term can be found anywhere inside line (even if searched term is not "add" change). Also index changes by file path and line numbers.
          * Now, first phase of parsing is done. We have javascript objects that facilitate further manipulations.
        */
        // Run and parse `git diff`.
        const diff = await this._gitApi.parseDiff();
        // Filter with saved regex term.
        const filteredChanges = [];
        // Containing filtered changes (File name -> change line -> change) Hash map. Index to process changes within a single line easier.
        const filteredChangesHashMap = {};
        const searchedTermRegex = new RegExp(searchInputValue, "g");
        diff.forEach((changedFile) => {
            let newIndex = undefined;
            changedFile.changes.forEach((fileChange) => {
                if ((fileChange.type === "add" &&
                    fileChange.content.match(searchedTermRegex) !== null) ||
                    fileChange.type === "del") {
                    // Create different object types for changed files. Later it will be easier to reason about this changed files.
                    if (newIndex === undefined) {
                        newIndex =
                            filteredChanges.push({
                                filePath: changedFile.filePath,
                                fileName: (0, utils_1.filenameFromPath)(changedFile.filePath),
                                fullFilePath: changedFile.fullFilePath,
                                changes: [fileChange],
                            }) - 1;
                    else {
                        // Rest of the changes matched in a file.
                        filteredChanges[newIndex].changes.push(fileChange);
                    }
                    // Index (aggregation) for changed files per line.
                    if (!filteredChangesHashMap[changedFile.fullFilePath])
                        filteredChangesHashMap[changedFile.fullFilePath] = {};
                    if (!filteredChangesHashMap[changedFile.fullFilePath][fileChange.line])
                        filteredChangesHashMap[changedFile.fullFilePath][fileChange.line] =
                            [];
                    filteredChangesHashMap[changedFile.fullFilePath][fileChange.line].push(fileChange);
                }
        });
        /*
          -----
          -- PAINTING CHANGES SUBROUTINE
          -----
    
          It will further filter changes by searched term and visualise searched changes.
    
          * First of all we need to make sure that lines that doesn't contain searched term strictly in *changes* will be eventually filtered out (filter lines that contain searched term but not in changes). See `filteredChangesLinesToFilterOut` array.
          * Find added positions in changed lines.
          * Decorate these positions.
        */
        // Get all visible to the user editors
        const editors = vscode.window.visibleTextEditors;
        // Array of changed files' indices in `filteredChanges` array and lines to filter out (where changes doesn't contain searched term).
        const filteredChangesLinesToFilterOut = [];
        filteredChanges.forEach((fileChange, fileChangeIndex) => {
            const changedFileFullPath = fileChange.fullFilePath;
            // For every changed file, try to find active editor.
            const editor = editors.find((e) => e.document.uri.path.toLocaleLowerCase() ===
                changedFileFullPath.toLocaleLowerCase());
            if (!editor)
                return;
            // If active editor with changes exist, get changed lines for this editor and find out what changed on a line level using some kind of LCS algorithm. After line changes are found filter them further to leave only positions that match with a searched term.
            const changes = filteredChangesHashMap[changedFileFullPath];
            for (const changeLineNumber in changes) {
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
                const originalToCurrentEditScript = (0, utils_1.myersDiff)(originalContent, currentContent);
                let termFoundInChanges = false;
                originalToCurrentEditScript.operations.forEach((operation) => {
                    // Use only adds.
                    if (operation.operation_type !== "Insert") {
                        return;
                    }
                    // Find terms in edit script.
                    const foundTerms = operation.content.match(searchedTermRegex);
                    if (foundTerms) {
                        termFoundInChanges = true;
                    }
                    // Extract positions.
                    const res = searchedTermRegex.exec(currentContent);
                    // Create decorations.
                    // ...
                    // Apply styles in found positions (vector or tuples (line, startCol, endCol)).
                    // ...
                });
                // If "add change" doesn't contain searched term then mark this line as irrelevant.
                if (!filteredChangesLinesToFilterOut[fileChangeIndex]) {
                    filteredChangesLinesToFilterOut[fileChangeIndex] = [];
                }
                if (!termFoundInChanges) {
                    filteredChangesLinesToFilterOut[fileChangeIndex].push(parseInt(changeLineNumber));
                }
            }
        });
        const fullyFilteredChanges = filteredChanges.map((fileChange, fileChangeIndex) => {
            const linesToFilter = filteredChangesLinesToFilterOut[fileChangeIndex];
            const updatedFileChange = { ...fileChange };
            if (linesToFilter &&
                Array.isArray(linesToFilter) &&
                linesToFilter.length > 0) {
                updatedFileChange.changes = fileChange.changes.filter((change) => !linesToFilter.includes(change.line));
            }
            return updatedFileChange;
        });
        this._view.webview.postMessage({
            command: "newResults",
            matches: fullyFilteredChanges,
        });
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
                    It looks like you don't have any repositories inside opened workspaces.
                </body>
            </html>
                    <script type="module" src="${this._WebviewUriProvider.getRedomWebviewUri()}"></script>
                    <script type="module" src="${this._WebviewUriProvider.getFileIconsJsWebviewUri()}"></script>
                    <link rel="stylesheet" href="${this._WebviewUriProvider.getFileIconsCssWebviewUri()}">
                    <link rel="stylesheet" href="${this._WebviewUriProvider.getStyleWebviewUri(["activity-bar-scripts.css"])}">
                
                    <div class="empty-search-input" id="emptySearchInput">Feel free to use above search input.</div>
                    <div class="results-container" id="resultsContainer"></div>
                    Extension didn't load correctly. Please try reloading VSC window.
/* 17 */
__exportStar(__webpack_require__(18), exports);
/* 18 */
/**
 * Helper for retrieving URLs to be used on a web views.
 */
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
    getStyleWebviewUri(scriptPath) {
        return this._getWebviewUri(["media", "styles", ...scriptPath]);
    }
/* 19 */
__exportStar(__webpack_require__(20), exports);
__exportStar(__webpack_require__(21), exports);
__exportStar(__webpack_require__(22), exports);
/* 20 */
/* 21 */
/* 22 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const Views_1 = __webpack_require__(13);