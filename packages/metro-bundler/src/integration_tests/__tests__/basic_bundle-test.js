/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @format
 */

'use strict';

jest.useRealTimers().unmock('fs').unmock('graceful-fs');

const Packager = require('../..');
const path = require('path');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30 * 1000;

const INPUT_PATH = path.resolve(__dirname, '../basic_bundle');
const POLYFILLS_PATH = path.resolve(__dirname, '../../Resolver/polyfills');

describe('basic_bundle', () => {
  const absPathRe = new RegExp(INPUT_PATH, 'g');
  const polyfill1 = path.join(INPUT_PATH, 'polyfill-1.js');
  const polyfill2 = path.join(INPUT_PATH, 'polyfill-2.js');

  beforeEach(() => {
    // Don't waste time creating a worker-farm from jest-haste-map, use the
    // function directly instead.
    jest.mock('worker-farm', () => {
      function workerFarm(opts, workerPath, methodNames) {
        return require(workerPath);
      }
      workerFarm.end = () => {};
      return workerFarm;
    });
    // We replace the farm by a simple require, so that the worker sources are
    // transformed and managed by jest.
    jest.mock('../../worker-farm', () => {
      let ended = false;

      function workerFarm(opts, workerPath, methodNames) {
        const {Readable} = require('stream');
        const methods = {};
        const worker = require(workerPath);

        methodNames.forEach(name => {
          methods[name] = function() {
            if (ended) {
              throw new Error('worker farm was ended');
            }
            return worker[name].apply(null, arguments);
          };
        });

        return {
          stdout: new Readable({read() {}}),
          stderr: new Readable({read() {}}),
          methods,
        };
      }

      workerFarm.end = () => {
        ended = true;
      };

      return workerFarm;
    });
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('bundles package with polyfills as expected', async () => {
    const bundleWithPolyfills = await Packager.buildBundle(
      {
        getPolyfills: () => [polyfill1, polyfill2],
        projectRoots: [INPUT_PATH, POLYFILLS_PATH],
        transformCache: Packager.TransformCaching.none(),
        transformModulePath: require.resolve('../../transformer'),
        nonPersistent: true,
      },
      {
        dev: false,
        entryFile: path.join(INPUT_PATH, 'TestBundle.js'),
        platform: 'ios',
      },
    );

    expect(
      bundleWithPolyfills.getSource().replace(absPathRe, ''),
    ).toMatchSnapshot();
  });

  it('bundles package without polyfills as expected', async () => {
    const bundleWithoutPolyfills = await Packager.buildBundle(
      {
        getPolyfills: () => [polyfill1, polyfill2],
        projectRoots: [INPUT_PATH, POLYFILLS_PATH],
        transformCache: Packager.TransformCaching.none(),
        transformModulePath: require.resolve('../../transformer'),
        nonPersistent: true,
      },
      {
        dev: false,
        entryFile: path.join(INPUT_PATH, 'TestBundle.js'),
        platform: 'ios',
      },
    );

    expect(
      bundleWithoutPolyfills.getSource().replace(absPathRe, ''),
    ).toMatchSnapshot();
  });
});
