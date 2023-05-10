// ****************************************************************************
//
// Copyright (C) 2008-2014, Roman Lygin. All rights reserved.
// Copyright (C) 2014-2023, CADEX. All rights reserved.
//
// This file is part of the CAD Exchanger software.
//
// You may use this file under the terms of the BSD license as follows:
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
// * Redistributions of source code must retain the above copyright notice,
//   this list of conditions and the following disclaimer.
// * Redistributions in binary form must reproduce the above copyright notice,
//   this list of conditions and the following disclaimer in the documentation
//   and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS'
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.
//
// ****************************************************************************

export const aPathToPrebuiltModels = '/data/models/native/';

/**
 * Returns MTK data of the converted model as JSON object.
 * @param {string} theModelName
 * @returns {Object} JSON
 */
export async function fetchProcessData(theModelName) {
  const aRes = await fetch(aPathToPrebuiltModels + theModelName + '/process_data.json');
  const aJSON = await aRes.json();
  return aJSON;
}

/**
 * Returns path to the converted model as a folder with the native extension.
 * @param {string} theModelId
 * @returns {string}
 */
export function modelUrl(theModelId) {
  /* If theModelId contains additional path: */
  const aPathToModel = theModelId.split('/');

  const anAdditionalPath = aPathToModel.length > 1 ? aPathToModel.slice(0, -1).join('/') + '/' : '';

  return aPathToPrebuiltModels + anAdditionalPath + aPathToModel.at(-1) + `/${aPathToModel.at(-1).split('.').slice(0, -1).join('')}.cdxfb`;
}

/**
 * Remote file data provider.
 * @param {string} theUrl
 * @returns {Promise<ArrayBuffer>}
 */
export async function fetchFile(theUrl) {
  return new Promise((theResolve, theReject) => {
    const aXHR = new XMLHttpRequest();
    aXHR.responseType = 'arraybuffer';
    aXHR.open('GET', theUrl, true);
    aXHR.onload = () => {
      if (aXHR.status >= 200 && aXHR.status < 300) {
        theResolve(aXHR.response);
      } else {
        theReject(new Error(aXHR.statusText));
      }
    };
    aXHR.onerror = () => {
      theReject(new Error(aXHR.statusText));
    };
    aXHR.send();
  })
}
