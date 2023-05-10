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

const anInputModelElement = document.getElementById('inputModel');
const anImportButton = document.getElementById('import-button');

/* On importing user model: */
anInputModelElement.addEventListener('change', (event) => {
  /* If the file is not selected in the dialog box, then do not send data to the server: */
  if (!event.target.files[0]) {
    return;
  }

  /* Show loader: */
  anImportButton.querySelector('img').classList.add('hidden');
  anImportButton.querySelector('.loader').classList.remove('hidden');

  /* Send user model via POST request to server: */
  const aFormData = new FormData();
  aFormData.append('data', event.target.files[0]);
  fetch('/model', {
    method: 'POST',
    body: aFormData,
  })
  .then((theResponse) => {
    if (theResponse.ok) {
      return theResponse.json();
    } else {
      /* Hide loader: */
      anImportButton.querySelector('.loader').classList.add('hidden');
      anImportButton.querySelector('img').classList.remove('hidden');
      alert(`Processing time error. Status: ${theResponse.status}`);
      throw new Error(`Processing time error. Status: ${theResponse.status}`);
    }
  })
  /* If the server-side conversion was successful, add a new card to the index page (AJAX): */
  .then((theResult) => {
    const aPathToModel = theResult.modelName;

    const aModelCard = document.createElement('a');
    aModelCard.classList.add('model-card');
    aModelCard.href = `/viewer/${aPathToModel}`;

    const anCardImgElement = document.createElement('img');
    anCardImgElement.classList.add('card-image');
    anCardImgElement.src = `/data/models/native/${aPathToModel}/thumbnail.png`;
    anCardImgElement.title = theResult.modelName;
    aModelCard.appendChild(anCardImgElement);

    const aCardTitleSpanElement = document.createElement('span');
    aCardTitleSpanElement.classList.add('card-title');
    aCardTitleSpanElement.innerHTML = theResult.modelName;
    aModelCard.appendChild(aCardTitleSpanElement);

    document.querySelector('.model-cards').appendChild(aModelCard);

    /* Hide loader: */
    anImportButton.querySelector('.loader').classList.add('hidden');
    anImportButton.querySelector('img').classList.remove('hidden');
  })
  .catch((theReason) => console.error(theReason))
  /* Now we need to reset the value of the input in order to be able to load the same model file for another process: */
  .finally(() => event.target.value = null);
});

/* Forwarding a click to the hidden input button: */
anImportButton.addEventListener('click', () => {
  anInputModelElement.click();
});

