// Copyright 2023 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as CodeMirror from '../../../../../../front_end/third_party/codemirror.next/codemirror.next.js';
import * as TextEditor from '../../../../../../front_end/ui/components/text_editor/text_editor.js';
import {renderElementIntoDOM} from '../../../helpers/DOMHelpers.js';
import {createFakeSetting, describeWithEnvironment} from '../../../helpers/EnvironmentHelpers.js';

const {assert} = chai;
const {Direction} = TextEditor.TextEditorHistory;

function setCodeMirrorContent(editor: CodeMirror.EditorView, content: string) {
  editor.dispatch({
    changes: {from: 0, to: editor.state.doc.length, insert: content},
  });
  assert.strictEqual(editor.state.doc.toString(), content);
}

function setCursorPosition(editor: CodeMirror.EditorView, pos: number) {
  editor.dispatch({
    selection: CodeMirror.EditorSelection.cursor(pos),
  });
  assert.strictEqual(editor.state.selection.main.head, pos);
}

describeWithEnvironment('TextEditorHistory', () => {
  let history: TextEditor.AutocompleteHistory.AutocompleteHistory;
  let editor: CodeMirror.EditorView;
  let textEditor: TextEditor.TextEditor.TextEditor;
  let editorHistory: TextEditor.TextEditorHistory.TextEditorHistory;

  beforeEach(() => {
    const setting = createFakeSetting('history', []);
    history = new TextEditor.AutocompleteHistory.AutocompleteHistory(setting);
    textEditor = new TextEditor.TextEditor.TextEditor();
    editor = textEditor.editor;  // Triggers actual editor creation.
    renderElementIntoDOM(textEditor);
    editorHistory = new TextEditor.TextEditorHistory.TextEditorHistory(textEditor, history);
  });

  afterEach(() => {
    // Manually remove the text editor from the DOM. The TextEditor
    // "disconnect" callback requires a settings environment.
    textEditor.remove();
  });

  describe('moveHistory', () => {
    it('can move through the history backwards', () => {
      history.pushHistoryItem('entry 1');
      history.pushHistoryItem('entry 2');

      editorHistory.moveHistory(Direction.BACKWARD);

      assert.strictEqual(editor.state.doc.toString(), 'entry 2');
    });

    it('can move through the history forwards', () => {
      history.pushHistoryItem('entry 1');
      history.pushHistoryItem('entry 2');
      editorHistory.moveHistory(Direction.BACKWARD);
      editorHistory.moveHistory(Direction.BACKWARD);

      editorHistory.moveHistory(Direction.FORWARD);

      assert.strictEqual(editor.state.doc.toString(), 'entry 2');
    });

    it('does not forget about the current input', () => {
      history.pushHistoryItem('entry 1');
      setCodeMirrorContent(editor, 'temporary content');

      editorHistory.moveHistory(Direction.BACKWARD);
      editorHistory.moveHistory(Direction.FORWARD);

      assert.strictEqual(editor.state.doc.toString(), 'temporary content');
    });

    it('does not go backwards if the cursor is not in the first line', () => {
      history.pushHistoryItem('entry 1');
      const editorText = 'first line\nsecond line';
      setCodeMirrorContent(editor, editorText);
      setCursorPosition(editor, editorText.length);

      assert.isFalse(editorHistory.moveHistory(Direction.BACKWARD));

      assert.strictEqual(editor.state.doc.toString(), editorText);
    });

    it('does go backwards if the cursor is not in the first line, but force is specified', () => {
      history.pushHistoryItem('entry 1');
      const editorText = 'first line\nsecond line';
      setCodeMirrorContent(editor, editorText);
      setCursorPosition(editor, editorText.length);

      assert.isTrue(editorHistory.moveHistory(Direction.BACKWARD, /* force */ true));

      assert.strictEqual(editor.state.doc.toString(), 'entry 1');
    });

    it('does not go forwards if the cursor is not in the last line', () => {
      history.pushHistoryItem('first line\nsecond line');
      editorHistory.moveHistory(Direction.BACKWARD);
      setCursorPosition(editor, 5);  // Somewhere on the first line.

      assert.isFalse(editorHistory.moveHistory(Direction.FORWARD));

      assert.strictEqual(editor.state.doc.toString(), 'first line\nsecond line');
    });

    it('does go forwards if the cursor is not in the last line, but force is specified', () => {
      history.pushHistoryItem('first line\nsecond line');
      editorHistory.moveHistory(Direction.BACKWARD);
      setCursorPosition(editor, 5);  // Somewhere on the first line.

      assert.isTrue(editorHistory.moveHistory(Direction.FORWARD, /* force */ true));

      assert.strictEqual(editor.state.doc.toString(), '');
    });

    it('sets the cursor to the end of the first line when moving backwards', () => {
      history.pushHistoryItem('first line\nsecond line');

      editorHistory.moveHistory(Direction.BACKWARD);

      assert.strictEqual(editor.state.selection.main.head, 10);
    });
  });
});
