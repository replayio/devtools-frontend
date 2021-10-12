// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as CodeMirror from '../../../third_party/codemirror.next/codemirror.next.js';

export function cursorTooltip(
    source: (state: CodeMirror.EditorState, pos: number) => Promise<(() => CodeMirror.TooltipView)|null>,
    ): CodeMirror.Extension {
  const openTooltip = CodeMirror.StateEffect.define<() => CodeMirror.TooltipView>();

  const state = CodeMirror.StateField.define<null|CodeMirror.Tooltip>({
    create() {
      return null;
    },
    update(val, tr) {
      if (tr.selection) {
        val = null;
      }
      if (val && !tr.changes.empty) {
        val = {pos: tr.changes.mapPos(val.pos), create: val.create, above: true};
      }
      for (const effect of tr.effects) {
        if (effect.is(openTooltip)) {
          val = {pos: tr.state.selection.main.from, create: effect.value, above: true};
        }
      }
      return val;
    },
    provide: field => CodeMirror.showTooltip.from(field),
  });

  const plugin = CodeMirror.ViewPlugin.fromClass(class {
    pending = -1;
    updateID = 0;

    update(update: CodeMirror.ViewUpdate): void {
      this.updateID++;
      if (update.transactions.some(tr => tr.selection) && update.state.selection.main.empty) {
        this.scheduleUpdate(update.view);
      }
    }

    scheduleUpdate(view: CodeMirror.EditorView): void {
      if (this.pending > -1) {
        clearTimeout(this.pending);
      }
      this.pending = setTimeout(() => this.startUpdate(view), 50) as unknown as number;
    }

    startUpdate(view: CodeMirror.EditorView): void {
      this.pending = -1;
      const {main} = view.state.selection;
      if (main.empty) {
        const {updateID} = this;
        source(view.state, main.from).then(tooltip => {
          if (this.updateID !== updateID) {
            if (this.pending < 0) {
              this.scheduleUpdate(view);
            }
          } else if (tooltip) {
            view.dispatch({effects: openTooltip.of(tooltip)});
          }
        });
      }
    }
  });

  return [state, plugin];
}