// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {assert} from 'chai';

import {$$, click, getBrowserAndPages, getTestServerPort, goToResource, pressKey, waitFor, waitForFunction} from '../../shared/helper.js';
import {describe, it} from '../../shared/mocha-extensions.js';
import {doubleClickSourceTreeItem, getFrameTreeTitles, getTrimmedTextContent, navigateToApplicationTab} from '../helpers/application-helpers.js';

const TOP_FRAME_SELECTOR = '[aria-label="top"]';
const WEB_WORKERS_SELECTOR = '[aria-label="Web Workers"]';
const SERVICE_WORKERS_SELECTOR = '[aria-label="top"] ~ ol [aria-label="Service Workers"]';
const OPENED_WINDOWS_SELECTOR = '[aria-label="Opened Windows"]';
const IFRAME_FRAME_ID_SELECTOR = '[aria-label="frameId (iframe.html)"]';
const MAIN_FRAME_SELECTOR = '[aria-label="frameId (main-frame.html)"]';
const IFRAME_SELECTOR = '[aria-label="iframe.html"]';
const EXPAND_STACKTRACE_BUTTON_SELECTOR = '.arrow-icon-button';
const STACKTRACE_ROW_SELECTOR = '.stack-trace-row';
const APPLICATION_PANEL_SELECTED_SELECTOR = '.tabbed-pane-header-tab.selected[aria-label="Application"]';

const getTrailingURL = (text: string): string => {
  const match = text.match(/http.*$/);
  return match ? match[0] : '';
};

const ensureApplicationPanel = async () => {
  if ((await $$(APPLICATION_PANEL_SELECTED_SELECTOR)).length === 0) {
    await waitForFunction(async () => {
      await click('#tab-resources');
      return (await $$(APPLICATION_PANEL_SELECTED_SELECTOR)).length === 1;
    });
  }
};

describe('The Application Tab', async () => {
  afterEach(async () => {
    const {target} = getBrowserAndPages();
    await target.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  });

  // Update and reactivate when the whole FrameDetailsView is a custom component
  it('shows details for a frame when clicked on in the frame tree', async () => {
    const {target} = getBrowserAndPages();
    await navigateToApplicationTab(target, 'frame-tree');
    await click('#tab-resources');
    await doubleClickSourceTreeItem(TOP_FRAME_SELECTOR);

    await waitForFunction(async () => {
      const fieldValues = await getTrimmedTextContent('devtools-report-value');
      if (fieldValues[0]) {
        // This contains some CSS from the svg icon link being rendered. It's
        // system-specific, so we get rid of it and only look at the (URL) text.
        fieldValues[0] = getTrailingURL(fieldValues[0]);
      }
      if (fieldValues[9] && fieldValues[9].includes('accelerometer')) {
        fieldValues[9] = 'accelerometer';
      }
      const expected = [
        `https://localhost:${getTestServerPort()}/test/e2e/resources/application/frame-tree.html`,
        `https://localhost:${getTestServerPort()}`,
        '<#document>',
        'Yes Localhost is always a secure context',
        'No',
        'None',
        'UnsafeNone',
        'unavailable requires cross-origin isolated context',
        'unavailable Learn more',
        'accelerometer',
      ];
      return JSON.stringify(fieldValues) === JSON.stringify(expected);
    });
  });


  it('shows stack traces for OOPIF', async () => {
    await goToResource('application/js-oopif.html');
    await ensureApplicationPanel();
    await waitForFunction(async () => {
      await doubleClickSourceTreeItem(TOP_FRAME_SELECTOR);
      await doubleClickSourceTreeItem(IFRAME_SELECTOR);
      return (await $$(EXPAND_STACKTRACE_BUTTON_SELECTOR)).length === 1;
    });
    await waitForFunction(async () => {
      await ensureApplicationPanel();
      await click(EXPAND_STACKTRACE_BUTTON_SELECTOR);
      const stackTraceRows = await getTrimmedTextContent(STACKTRACE_ROW_SELECTOR);
      const expected = [
        'second @ js-oopif.html:17',
        'first @ js-oopif.html:11',
        '(anonymous) @ js-oopif.html:20',
      ];
      return JSON.stringify(stackTraceRows) === JSON.stringify(expected);
    });
  });

  it('shows details for opened windows in the frame tree', async () => {
    const {target} = getBrowserAndPages();
    await navigateToApplicationTab(target, 'frame-tree');
    await click('#tab-resources');
    await doubleClickSourceTreeItem(TOP_FRAME_SELECTOR);

    await target.evaluate(() => {
      window.open('iframe.html');
    });

    await doubleClickSourceTreeItem(OPENED_WINDOWS_SELECTOR);
    await waitFor(`${OPENED_WINDOWS_SELECTOR} + ol li:first-child`);
    pressKey('ArrowDown');

    await waitForFunction(async () => {
      const fieldValues = await getTrimmedTextContent('.report-field-value');
      const expected = [
        `https://localhost:${getTestServerPort()}/test/e2e/resources/application/iframe.html`,
        '<#document>',
        'Yes',
      ];
      return JSON.stringify(fieldValues) === JSON.stringify(expected);
    });
  });

  it('shows dedicated workers in the frame tree', async () => {
    const {target} = getBrowserAndPages();
    await goToResource('application/frame-tree.html');
    await click('#tab-resources');
    await doubleClickSourceTreeItem(TOP_FRAME_SELECTOR);
    // DevTools is not ready yet when the worker is being initially attached.
    // We therefore need to reload the page to see the worker in DevTools.
    await target.reload();
    await doubleClickSourceTreeItem(WEB_WORKERS_SELECTOR);
    await waitFor(`${WEB_WORKERS_SELECTOR} + ol li:first-child`);
    pressKey('ArrowDown');

    await waitForFunction(async () => {
      const fieldValues = await getTrimmedTextContent('.report-field-value');
      const expected = [
        `https://localhost:${getTestServerPort()}/test/e2e/resources/application/dedicated-worker.js`,
        'Web Worker',
        'None',
      ];
      return JSON.stringify(fieldValues) === JSON.stringify(expected);
    });
  });

  it('shows service workers in the frame tree', async () => {
    await goToResource('application/service-worker-network.html');
    await click('#tab-resources');
    await doubleClickSourceTreeItem(TOP_FRAME_SELECTOR);
    await doubleClickSourceTreeItem(SERVICE_WORKERS_SELECTOR);
    await waitFor(`${SERVICE_WORKERS_SELECTOR} + ol li:first-child`);
    pressKey('ArrowDown');

    await waitForFunction(async () => {
      const fieldValues = await getTrimmedTextContent('.report-field-value');
      const expected = [
        `https://localhost:${getTestServerPort()}/test/e2e/resources/application/service-worker.js`,
        'Service Worker',
        'None',
      ];
      return JSON.stringify(fieldValues) === JSON.stringify(expected);
    });
  });

  // Update and reactivate when the whole FrameDetailsView is a custom component
  it('can handle when JS writes to frame', async () => {
    const {target} = getBrowserAndPages();
    await goToResource('application/main-frame.html');
    await click('#tab-resources');
    await doubleClickSourceTreeItem(TOP_FRAME_SELECTOR);
    await doubleClickSourceTreeItem(IFRAME_FRAME_ID_SELECTOR);

    // check iframe's URL after pageload
    await waitForFunction(async () => {
      const fieldValues = await getTrimmedTextContent('devtools-report-value');
      if (fieldValues[0]) {
        // This contains some CSS from the svg icon link being rendered. It's
        // system-specific, so we get rid of it and only look at the (URL) text.
        fieldValues[0] = getTrailingURL(fieldValues[0]);
      }
      if (fieldValues[9] && fieldValues[9].includes('accelerometer')) {
        fieldValues[9] = 'accelerometer';
      }
      const expected = [
        `https://localhost:${getTestServerPort()}/test/e2e/resources/application/iframe.html`,
        `https://localhost:${getTestServerPort()}`,
        '<iframe>',
        'Yes Localhost is always a secure context',
        'No',
        'None',
        'UnsafeNone',
        'unavailable requires cross-origin isolated context',
        'unavailable Learn more',
        'accelerometer',
      ];
      return JSON.stringify(fieldValues) === JSON.stringify(expected);
    });

    assert.deepEqual(await getFrameTreeTitles(), ['top', 'frameId (iframe.html)', 'iframe.html', 'main-frame.html']);

    // write to the iframe using 'document.write()'
    await target.evaluate(() => {
      const frame = document.getElementById('frameId') as HTMLIFrameElement;
      const doc = frame.contentDocument;
      if (doc) {
        doc.open();
        doc.write('<h1>Hello world !</h1>');
        doc.close();
      }
    });

    // check that iframe's URL has changed
    await doubleClickSourceTreeItem(MAIN_FRAME_SELECTOR);
    await waitForFunction(async () => {
      const fieldValues = await getTrimmedTextContent('devtools-report-value');
      if (fieldValues[0]) {
        fieldValues[0] = getTrailingURL(fieldValues[0]);
      }
      if (fieldValues[9] && fieldValues[9].includes('accelerometer')) {
        fieldValues[9] = 'accelerometer';
      }
      const expected = [
        `https://localhost:${getTestServerPort()}/test/e2e/resources/application/main-frame.html`,
        `https://localhost:${getTestServerPort()}`,
        '<iframe>',
        'Yes Localhost is always a secure context',
        'No',
        'None',
        'UnsafeNone',
        'unavailable requires cross-origin isolated context',
        'unavailable Learn more',
        'accelerometer',
      ];
      return JSON.stringify(fieldValues) === JSON.stringify(expected);
    });

    assert.deepEqual(
        await getFrameTreeTitles(), ['top', 'frameId (main-frame.html)', 'Document not available', 'main-frame.html']);
  });
});
