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
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
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

const express = require('express');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const process = require('process');

const router = express.Router();

const aPathToConverterExe = process.platform === 'linux' ?
    path.join(__dirname, '../converter/MTKConverter') :
    path.join(__dirname, '../converter/MTKConverter.exe');
const aPathToUploadFolder = path.join(__dirname, '../public/data/models/upload');
const aPathToNativeFolder = path.join(__dirname, '../public/data/models/native');

/**
 * Return the name of the processing operation.
 * @param {string} thePath The path to the process data file.
 * @return {string | undefined}
 */
const getNameOfOperation = (thePath) => {
  const aProcessData = JSON.parse(fs.readFileSync(thePath));
  return aProcessData?.parts?.[0].process;
};

/* Declare a storage object for storing user-loaded models: */
const storage = multer.diskStorage({
  destination: aPathToUploadFolder,
  filename: function (_, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

/* Processing a GET request for index page: */
router.get('/', function(_, theRes, _) {
  const aProcessModelNameMatrix = fs.readdirSync(aPathToNativeFolder)
    .map((theProcessFolderName) => fs.readdirSync(path.join(aPathToNativeFolder, theProcessFolderName))
      .map((theModelFolderName) => ({ process: theProcessFolderName, model: theModelFolderName })))
    .reduce((thePrev, theCurr) => thePrev.concat(theCurr), []);

  /* Form the prebuiltModels object for transfer to the index page template engine: */
  const aPrebuiltModels = aProcessModelNameMatrix
    .reduce((thePrev, theCurr) => {
      thePrev.push({
        processTitle: getNameOfOperation(path.join(aPathToNativeFolder, theCurr.process, theCurr.model, 'process_data.json')) || 'Unknown',
        title: theCurr.model,
        href: `/viewer/${theCurr.process}/${theCurr.model}`,
        src: `/data/models/native/${theCurr.process}/${theCurr.model}/thumbnail.png`,
      });
      return thePrev;
    }, []);

  theRes.render('index', {
    title: 'Manufacturing Toolkit - CNC Machining example',
    header: 'Manufacturing Toolkit - CNC Machining example',
    prebuiltModels: aPrebuiltModels,
  });
});

/* Processing a POST request for index page: */
router.post(
  '/model',
  /* multer storage middleware: */upload.single(/* "fieldname" is the key from FormData: */'data'),
  function(theReq, theRes, _) {
    /* Get the operation from the request (the default machining_milling operation): */
    const aConverterOperation = theReq.body.operation || 'machining_milling';

    /* Call MTKConverter for user-loaded model and send the result to browser: */
    exec(
      `"${aPathToConverterExe}" -i "${path.join(theReq.file.destination, theReq.file.originalname)}" -p ${aConverterOperation} -e "${path.join(aPathToNativeFolder, aConverterOperation, theReq.file.originalname)}"`,
      (theError) => {
        if (theError) {
          console.error(`MTKConverter error: ${theError}`);
          theRes.status('500').send(theError.message);
          return;
        } else {
          theRes.status(201).send({
            additionalPath: aConverterOperation,
            modelName: theReq.file.originalname,
            operation: getNameOfOperation(path.join(aPathToNativeFolder, aConverterOperation, theReq.file.originalname, 'process_data.json')) || 'Unknown',
          });
        }
      }
    );
});

module.exports = router;
