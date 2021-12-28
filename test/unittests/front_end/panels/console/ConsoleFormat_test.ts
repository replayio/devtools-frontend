// Copyright (c) 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../../../front_end/core/sdk/sdk.js';
import * as Console from '../../../../../front_end/panels/console/console.js';

const {assert} = chai;

describe('ConsoleFormat', () => {
  describe('format', () => {
    it('deals with empty format string', () => {
      assert.deepNestedPropertyVal(Console.ConsoleFormat.format('', []), 'tokens', []);
    });

    it('yields unused arguments', () => {
      const argNumber = SDK.RemoteObject.RemoteObject.fromLocalObject(42);
      const argString = SDK.RemoteObject.RemoteObject.fromLocalObject('Hello World!');
      const argSymbol = SDK.RemoteObject.RemoteObject.fromLocalObject(Symbol('My very special Symbol'));
      const {args} = Console.ConsoleFormat.format('This string is boring!', [argNumber, argString, argSymbol]);
      assert.lengthOf(args, 3);
      assert.strictEqual(args[0], argNumber);
      assert.strictEqual(args[1], argString);
      assert.strictEqual(args[2], argSymbol);
    });

    it('deals with format strings without formatting specifiers', () => {
      assert.deepNestedPropertyVal(
          Console.ConsoleFormat.format('This string does NOT contain specifiers', []), 'tokens', [
            {
              type: 'string',
              value: 'This string does NOT contain specifiers',
            },
          ]);
    });

    it('replaces %% with %', () => {
      assert.deepNestedPropertyVal(Console.ConsoleFormat.format('Go 100%%, and then another 50%%!', []), 'tokens', [
        {type: 'string', value: 'Go 100%, and then another 50%!'},
      ]);
    });

    it('deals with trailing %', () => {
      assert.deepNestedPropertyVal(Console.ConsoleFormat.format('75%', []), 'tokens', [
        {type: 'string', value: '75%'},
      ]);
    });

    it('deals with %o and %O', () => {
      const argFirst = SDK.RemoteObject.RemoteObject.fromLocalObject({'first': 1});
      const argSecond = SDK.RemoteObject.RemoteObject.fromLocalObject({'second': 2});
      const {tokens} = Console.ConsoleFormat.format('%o %O', [argFirst, argSecond]);
      assert.lengthOf(tokens, 3);
      assert.propertyVal(tokens[0], 'type', 'optimal');
      assert.propertyVal(tokens[0], 'value', argFirst);
      assert.propertyVal(tokens[1], 'type', 'string');
      assert.propertyVal(tokens[1], 'value', ' ');
      assert.propertyVal(tokens[2], 'type', 'generic');
      assert.propertyVal(tokens[2], 'value', argSecond);
    });

    it('deals with %c', () => {
      assert.deepNestedPropertyVal(
          Console.ConsoleFormat.format(
              '%cColorful%c!',
              [
                SDK.RemoteObject.RemoteObject.fromLocalObject('color: red'),
                SDK.RemoteObject.RemoteObject.fromLocalObject('color: black'),
              ]),
          'tokens', [
            {type: 'style', value: 'color: red'},
            {type: 'string', value: 'Colorful'},
            {type: 'style', value: 'color: black'},
            {type: 'string', value: '!'},
          ]);
    });

    it('eats arguments with %_', () => {
      const argFirst = SDK.RemoteObject.RemoteObject.fromLocalObject({'first': 1});
      const argSecond = SDK.RemoteObject.RemoteObject.fromLocalObject({'second': 2});
      const argThird = SDK.RemoteObject.RemoteObject.fromLocalObject({'third': 3});
      const {tokens, args} = Console.ConsoleFormat.format('This is%_ some %_text!', [argFirst, argSecond, argThird]);
      assert.lengthOf(args, 1);
      assert.strictEqual(args[0], argThird);
      assert.lengthOf(tokens, 1);
      assert.propertyVal(tokens[0], 'type', 'string');
      assert.propertyVal(tokens[0], 'value', 'This is some text!');
    });

    it('leaves unsatisfied formatting specifiers in place', () => {
      assert.deepNestedPropertyVal(Console.ConsoleFormat.format('%_ %O %o %d %i %f %s %c', []), 'tokens', [
        {type: 'string', value: '%_ %O %o %d %i %f %s %c'},
      ]);
    });

    it('deals with %s', () => {
      assert.deepNestedPropertyVal(
          Console.ConsoleFormat.format(
              '%s%s%s!',
              [
                SDK.RemoteObject.RemoteObject.fromLocalObject('Hello'),
                SDK.RemoteObject.RemoteObject.fromLocalObject(' '),
                SDK.RemoteObject.RemoteObject.fromLocalObject('World'),
              ]),
          'tokens', [
            {type: 'string', value: 'Hello World!'},
          ]);
      assert.deepNestedPropertyVal(
          Console.ConsoleFormat.format(
              '%s!',
              [
                SDK.RemoteObject.RemoteObject.fromLocalObject('%s %s'),
                SDK.RemoteObject.RemoteObject.fromLocalObject('Hello'),
                SDK.RemoteObject.RemoteObject.fromLocalObject('World'),
              ]),
          'tokens', [
            {type: 'string', value: 'Hello World!'},
          ]);
    });

    it('deals with %d, %i, and %f', () => {
      assert.deepNestedPropertyVal(
          Console.ConsoleFormat.format(
              '%d %i %f',
              [
                SDK.RemoteObject.RemoteObject.fromLocalObject(42.1),
                SDK.RemoteObject.RemoteObject.fromLocalObject(21.5),
                SDK.RemoteObject.RemoteObject.fromLocalObject(3.1415),
              ]),
          'tokens', [
            {type: 'string', value: '42 21 3.1415'},
          ]);
      assert.deepNestedPropertyVal(
          Console.ConsoleFormat.format(
              '%f %i %d',
              [
                SDK.RemoteObject.RemoteObject.fromLocalObject(Symbol('Some %s')),
                SDK.RemoteObject.RemoteObject.fromLocalObject('Some %s'),
                SDK.RemoteObject.RemoteObject.fromLocalObject(false),
              ]),
          'tokens', [
            {type: 'string', value: 'NaN NaN NaN'},
          ]);
    });

    it('deals with ANSI color codes to change font weight and style', () => {
      assert.deepNestedPropertyVal(Console.ConsoleFormat.format('\x1B[1ma\x1B[2mb\x1B[22mc', []), 'tokens', [
        {type: 'style', value: 'font-weight:bold'},
        {type: 'string', value: 'a'},
        {type: 'style', value: 'font-weight:lighter'},
        {type: 'string', value: 'b'},
        {type: 'style', value: ''},
        {type: 'string', value: 'c'},
      ]);
      assert.deepNestedPropertyVal(Console.ConsoleFormat.format('\x1B[3ma\x1B[23mb', []), 'tokens', [
        {type: 'style', value: 'font-style:italic'},
        {type: 'string', value: 'a'},
        {type: 'style', value: ''},
        {type: 'string', value: 'b'},
      ]);
      assert.deepNestedPropertyVal(Console.ConsoleFormat.format('\x1B[3;1ma\x1B[23mb\x1B[22;3mc', []), 'tokens', [
        {type: 'style', value: 'font-style:italic;font-weight:bold'},
        {type: 'string', value: 'a'},
        {type: 'style', value: 'font-weight:bold'},
        {type: 'string', value: 'b'},
        {type: 'style', value: 'font-style:italic'},
        {type: 'string', value: 'c'},
      ]);
    });

    it('deals with ANSI color codes to change text decoration', () => {
      assert.deepNestedPropertyVal(
          Console.ConsoleFormat.format('\x1B[4m1\x1B[9;24;53m2\x1B[29;4;53m3\x1B[24;29;55m', []), 'tokens', [
            {type: 'style', value: 'text-decoration:underline'},
            {type: 'string', value: '1'},
            {type: 'style', value: 'text-decoration:line-through overline'},
            {type: 'string', value: '2'},
            {type: 'style', value: 'text-decoration:overline underline'},
            {type: 'string', value: '3'},
            {type: 'style', value: ''},
          ]);
    });

    it('deals with unsupported ANSI color codes', () => {
      assert.deepNestedPropertyVal(
          Console.ConsoleFormat.format('\x1B[1;254mHello\x1B[255m\x1B[2mWorld\x1B[128m', []), 'tokens', [
            {type: 'style', value: 'font-weight:bold'},
            {type: 'string', value: 'Hello'},
            {type: 'style', value: 'font-weight:bold'},
            {type: 'style', value: 'font-weight:lighter'},
            {type: 'string', value: 'World'},
            {type: 'style', value: 'font-weight:lighter'},
          ]);
      assert.deepNestedPropertyVal(Console.ConsoleFormat.format('\x1B[232;255;254m', []), 'tokens', [
        {type: 'style', value: ''},
      ]);
    });

    it('deals with ANSI SGR reset parameter', () => {
      assert.deepNestedPropertyVal(Console.ConsoleFormat.format('\x1B[m', []), 'tokens', [
        {type: 'style', value: ''},
      ]);
      assert.deepNestedPropertyVal(Console.ConsoleFormat.format('\x1B[0m', []), 'tokens', [
        {type: 'style', value: ''},
      ]);
      assert.deepNestedPropertyVal(Console.ConsoleFormat.format('\x1B[1;2;m', []), 'tokens', [
        {type: 'style', value: ''},
      ]);
      assert.deepNestedPropertyVal(Console.ConsoleFormat.format('\x1B[1mA\x1B[3mB\x1B[0mC', []), 'tokens', [
        {type: 'style', value: 'font-weight:bold'},
        {type: 'string', value: 'A'},
        {type: 'style', value: 'font-weight:bold;font-style:italic'},
        {type: 'string', value: 'B'},
        {type: 'style', value: ''},
        {type: 'string', value: 'C'},
      ]);
    });

    it('leaves broken ANSI escape sequences in place', () => {
      assert.deepNestedPropertyVal(Console.ConsoleFormat.format('Bar\x1B[90', []), 'tokens', [
        {type: 'string', value: 'Bar\x1B[90'},
      ]);
      assert.deepNestedPropertyVal(Console.ConsoleFormat.format('\x1B[39FOO', []), 'tokens', [
        {type: 'string', value: '\x1B[39FOO'},
      ]);
    });

    it('deals with ANSI color codes', () => {
      [
          // Foreground codes
          [30, 'color:#000000'],
          [31, 'color:#AA0000'],
          [32, 'color:#00AA00'],
          [33, 'color:#AA5500'],
          [34, 'color:#0000AA'],
          [35, 'color:#AA00AA'],
          [36, 'color:#00AAAA'],
          [37, 'color:#AAAAAA'],
          [90, 'color:#555555'],
          [91, 'color:#FF5555'],
          [92, 'color:#55FF55'],
          [93, 'color:#FFFF55'],
          [94, 'color:#5555FF'],
          [95, 'color:#FF55FF'],
          [96, 'color:#55FFFF'],
          [97, 'color:#FFFFFF'],
          // Background codes
          [40, 'background:#000000'],
          [41, 'background:#AA0000'],
          [42, 'background:#00AA00'],
          [43, 'background:#AA5500'],
          [44, 'background:#0000AA'],
          [45, 'background:#AA00AA'],
          [46, 'background:#00AAAA'],
          [47, 'background:#AAAAAA'],
          [100, 'background:#555555'],
          [101, 'background:#FF5555'],
          [102, 'background:#55FF55'],
          [103, 'background:#FFFF55'],
          [104, 'background:#5555FF'],
          [105, 'background:#FF55FF'],
          [106, 'background:#55FFFF'],
          [107, 'background:#FFFFFF'],
      ].forEach(([code, value]) => {
        assert.deepNestedPropertyVal(Console.ConsoleFormat.format(`\x1B[${code}m`, []), 'tokens', [
          {type: 'style', value},
        ]);
      });
      for (let i = 0; i <= 255; i += 33) {
        assert.deepNestedPropertyVal(
            Console.ConsoleFormat.format(`\x1B[38;2;${i}m\x1B[38;2;5;${i};m\x1B[48;2;${i};${i};${i};39m\x1B[49m`, []),
            'tokens', [
              {type: 'style', value: `color:rgb(${i},0,0)`},
              {type: 'style', value: `color:rgb(5,${i},0)`},
              {type: 'style', value: `background:rgb(${i},${i},${i})`},
              {type: 'style', value: ''},
            ]);
      }
    });

    it('deals with ANSI colors and formatting specifiers', () => {
      const {tokens} = Console.ConsoleFormat.format(
          '\x1B[30m%d\x1B[31m%f\x1B[32m%s\x1B[33m%d\x1B[34m%f\x1B[35m%s\x1B[36m%d\x1B[37m%f\x1B[m',
          [1, 1.1, 'a', 2, 2.2, 'b', 3, 3.3].map(obj => SDK.RemoteObject.RemoteObject.fromLocalObject(obj)));
      assert.deepEqual(tokens, [
        {type: 'style', value: 'color:#000000'},
        {type: 'string', value: '1'},
        {type: 'style', value: 'color:#AA0000'},
        {type: 'string', value: '1.1'},
        {type: 'style', value: 'color:#00AA00'},
        {type: 'string', value: 'a'},
        {type: 'style', value: 'color:#AA5500'},
        {type: 'string', value: '2'},
        {type: 'style', value: 'color:#0000AA'},
        {type: 'string', value: '2.2'},
        {type: 'style', value: 'color:#AA00AA'},
        {type: 'string', value: 'b'},
        {type: 'style', value: 'color:#00AAAA'},
        {type: 'string', value: '3'},
        {type: 'style', value: 'color:#AAAAAA'},
        {type: 'string', value: '3.3'},
        {type: 'style', value: ''},
      ]);
    });

    it('deals with ANSI color combinations', () => {
      const {tokens} = Console.ConsoleFormat.format(
          '\x1B[30m1\x1B[40m2\x1B[31m3\x1B[41m4\x1B[90m5\x1B[100m6\x1B[91m7\x1B[101m8', []);
      assert.deepEqual(tokens, [
        {type: 'style', value: 'color:#000000'},
        {type: 'string', value: '1'},
        {type: 'style', value: 'color:#000000;background:#000000'},
        {type: 'string', value: '2'},
        {type: 'style', value: 'color:#AA0000;background:#000000'},
        {type: 'string', value: '3'},
        {type: 'style', value: 'color:#AA0000;background:#AA0000'},
        {type: 'string', value: '4'},
        {type: 'style', value: 'color:#555555;background:#AA0000'},
        {type: 'string', value: '5'},
        {type: 'style', value: 'color:#555555;background:#555555'},
        {type: 'string', value: '6'},
        {type: 'style', value: 'color:#FF5555;background:#555555'},
        {type: 'string', value: '7'},
        {type: 'style', value: 'color:#FF5555;background:#FF5555'},
        {type: 'string', value: '8'},
      ]);
    });
  });
});