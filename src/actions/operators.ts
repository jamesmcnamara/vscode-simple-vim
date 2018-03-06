import * as vscode from 'vscode';

import { Action } from '../action_types';
import { operatorMotions } from './operator_motions';
import { parseKeysOperator } from '../parse_keys';
import { enterInsertMode, enterNormalMode, setModeCursorStyle, enterVisualLineMode, enterVisualMode } from '../modes';
import { removeTypeSubscription } from '../type_subscription';
import { VimState } from '../vim_state_types';
import { Mode } from '../modes_types';
import { VimRange } from '../vim_range_types';
import { flashYankHighlight } from '../yank_highlight';

export const operators: Action[] = [
    parseKeysOperator(['d'], operatorMotions, (vimState, editor, ranges) => {
        if (ranges.every(x => x === undefined)) return;

        cursorsToRangesStart(editor, ranges);

        delete_(editor, ranges);

        if (vimState.mode === Mode.Visual || vimState.mode === Mode.VisualLine) {
            enterNormalMode(vimState);
            setModeCursorStyle(vimState.mode, editor);
        }
    }),
    parseKeysOperator(['c'], operatorMotions, (vimState, editor, ranges) => {
        if (ranges.every(x => x === undefined)) return;

        cursorsToRangesStart(editor, ranges);

        editor.edit(editBuilder => {
            ranges.forEach(range => {
                if (!range) return;
                editBuilder.delete(range.range);
            });

        });

        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),
    parseKeysOperator(['y'], operatorMotions, (vimState, editor, ranges) => {
        if (ranges.every(x => x === undefined)) return;

        yank(vimState, editor, ranges);

        if (vimState.mode === Mode.Visual || vimState.mode === Mode.VisualLine) {
            // Move cursor to start of yanked text
            editor.selections = editor.selections.map(selection => {
                return new vscode.Selection(selection.start, selection.start);
            });

            enterNormalMode(vimState);
            setModeCursorStyle(vimState.mode, editor);
        } else {
            // Yank highlight
            const highlightRanges: vscode.Range[] = [];
            ranges.forEach(range => {
                if (range) {
                    highlightRanges.push(new vscode.Range(range.range.start, range.range.end));
                }
            });
            flashYankHighlight(editor, highlightRanges);
        }
    }),
    parseKeysOperator(['r'], operatorMotions, (vimState, editor, ranges) => {
        if (ranges.every(x => x === undefined)) return;

        cursorsToRangesStart(editor, ranges);

        yank(vimState, editor, ranges);
        delete_(editor, ranges);

        if (vimState.mode === Mode.Visual || vimState.mode === Mode.VisualLine) {
            enterNormalMode(vimState);
            setModeCursorStyle(vimState.mode, editor);
        }
    }),
    parseKeysOperator(['s'], operatorMotions, (vimState, editor, ranges) => {
        if (
            ranges.every(x => x === undefined) ||
            vimState.mode === Mode.Visual ||
            vimState.mode === Mode.VisualLine
        ) {
            return;
        }

        editor.selections = ranges.map((range, i) => {
            if (range) {
                const start = range.range.start;
                const end = range.range.end;
                return new vscode.Selection(start, end);
            } else {
                return editor.selections[i];
            }
        });

        if (ranges.some(range => range ? range.linewise : false)) {
            enterVisualLineMode(vimState);
        } else {
            enterVisualMode(vimState);
        }

        setModeCursorStyle(vimState.mode, editor);
    }),
];

function cursorsToRangesStart(editor: vscode.TextEditor, ranges: (VimRange | undefined)[]) {
    editor.selections = editor.selections.map((selection, i) => {
        const range = ranges[i];

        if (range) {
            const newPosition = range.range.start;
            return new vscode.Selection(newPosition, newPosition);
        } else {
            return selection;
        }
    });
}

function delete_(editor: vscode.TextEditor, ranges: (VimRange | undefined)[]) {
    editor.edit(editBuilder => {
        ranges.forEach(range => {
            if (!range) return;

            let vscodeRange = range.range;

            if (range.linewise) {
                const end = range.range.end;
                vscodeRange = new vscode.Range(
                    range.range.start,
                    new vscode.Position(end.line + 1, 0),
                );
            }

            editBuilder.delete(vscodeRange);
        });
    });
}

function yank(vimState: VimState, editor: vscode.TextEditor, ranges: (VimRange | undefined)[]) {
    vimState.registers = ranges.map((range, i) => {
        if (range) {
            return {
                contents: editor.document.getText(range.range),
                linewise: range.linewise,
            };
        } else {
            return vimState.registers[i];
        }
    });
}
