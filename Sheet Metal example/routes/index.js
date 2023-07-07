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

const router = express.Router();

const aPathToConverterExe = path.join(__dirname, '../converter/MTKConverter.exe');
const aPathToUploadFolder = path.join(__dirname, '../public/static/data/examples/upload');
const aPathToNativeFolder = path.join(__dirname, '../public/static/data/examples/sheet_metal');

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
  /* Form the prebuiltModels object for transfer to the index page template engine: */
  const aPrebuiltModels = fs.readdirSync(aPathToNativeFolder)
    .reduce((thePrev, theCurr) => {
      thePrev.push({
        title: theCurr,
        href: `/viewer/${theCurr}`,
        src: `/static/data/examples/sheet_metal/${theCurr}/thumbnail.png`,
      });
      return thePrev;
    }, []);

  theRes.render('index', {
    title: 'Manufacturing Toolkit - Sheet Metal example',
    header: 'Manufacturing Toolkit - Sheet Metal example',
    prebuiltModels: aPrebuiltModels,
  });
});

/* Processing a POST request for index page: */
router.post(
  '/model',
  /* multer storage middleware: */upload.single(/* "fieldname" is the key from FormData: */'data'),
  function(theReq, theRes, _) {
    /* Call MTKConverter for user-loaded model and send the result to browser: */
    exec(
      `"${aPathToConverterExe}" -i "${path.join(theReq.file.destination, theReq.file.originalname)}" -p sheet_metal -e "${path.join(aPathToNativeFolder, theReq.file.originalname)}"`,
      (theError) => {
        if (theError) {
          console.error(`MTKConverter error: ${theError}`);
          theRes.status('500').send(theError.message);
          return;
        } else {
          /* If the resulting native folder doesn't include the original model name: */
          for (const filename of fs.readdirSync(path.join(aPathToNativeFolder, theReq.file.originalname))) {
            if (filename === '.cdxfb') {
              fs.renameSync(path.join(aPathToNativeFolder, theReq.file.originalname, filename), path.join(aPathToNativeFolder, theReq.file.originalname, `${theReq.file.originalname.split('.').slice(0, -1).join('')}.cdxfb`));
            }
            if (filename === '_unfolded.cdxfb') {
              fs.renameSync(path.join(aPathToNativeFolder, theReq.file.originalname, filename), path.join(aPathToNativeFolder, theReq.file.originalname, `${theReq.file.originalname.split('.').slice(0, -1).join('')}_unfolded.cdxfb`));
            }
          }

          theRes.status(201).send({
            modelName: theReq.file.originalname,
          });
        }
      }
    );
});

module.exports = router;
