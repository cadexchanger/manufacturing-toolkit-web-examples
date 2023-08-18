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

import cadex from '@cadexchanger/web-toolkit';

import { Viewer } from '/static/js/viewer.mjs';

/**
 * @typedef ShapeID
 * @property {string} id
 */

/**
 * @typedef Feature
 * @property {string} shapeIDCount
 * @property {Array<ShapeID>} shapeIDs
 */

/**
 * @typedef Parameter
 * @property {string} name
 * @property {string} units
 * @property {string} value
 */

/**
 * @typedef SubGroup
 * @property {string} parametersCount
 * @property {Array<Parameter>} parameters
 * @property {string} featureCount
 * @property {Array<Feature>} features
 */

/**
 * @typedef FeatureGroup
 * @property {string} name
 * @property {string} color like "(126, 10, 1)"
 * @property {string} totalGroupFeatureCount
 * @property {string | undefined} subGroupCount
 * @property {Array<SubGroup> | undefined} subGroups
 * @property {string | undefined} featureCount
 * @property {Array<Feature> | undefined} features
 */

/**
 * @typedef ProcessData
 * @property {string} name section name
 * @property {string | undefined} totalFeatureCount overall features count found by feature recognition or dfm analysis
 * @property {Array<FeatureGroup> | undefined} featureGroups list of all found feature groups
 * @property {string | undefined} message
 */

/**
 * @typedef ProcessDataPart
 * @property {string} partId ID of the corresponding part of model
 * @property {string} process name of the usd process
 * @property {string} error error message if conversion failed
 * @property {ProcessData} dfm section with dfm analysis information
 * @property {ProcessData} featureRecognition section with feature recognition information
 */

/**
 * @typedef CollectedPart
 * @property {string} id
 * @property {string} label
 * @property {cadex.ModelData_Part} sge
 * @property {cadex.ModelData_Representation} representation
 */

const aPathToPrebuiltModels = '/static/data/examples/machining/';

/**
* Returns MTK data of the converted model as JSON object.
* @param {string} theModelName
* @returns {Promise<Object>} JSON
*/
async function fetchProcessData(theModelName) {
  const aRes = await fetch(aPathToPrebuiltModels + theModelName + '/process_data.json');
  const aJSON = await aRes.json();
  return aJSON;
}

/**
* Returns path to the converted model as a folder with the native extension.
* @param {string} theModelId
* @returns {string}
*/
function modelUrl(theModelId) {
  return aPathToPrebuiltModels + theModelId + `/${theModelId.split('.').slice(0, -1).join('')}.cdxweb`;
}

/**
* Remote file data provider.
* @param {string} theUrl
* @returns {Promise<ArrayBuffer>}
*/
async function fetchFile(theUrl) {
  return new Promise((theResolve, theReject) => {
    const aXHR = new XMLHttpRequest();
    aXHR.responseType = 'arraybuffer';
    aXHR.open('GET', theUrl, true);
    aXHR.onload = () => {
      if (aXHR.status >= 200 && aXHR.status < 300) {
        theResolve(aXHR.response);
      }
      else {
        theReject(new Error(aXHR.statusText));
      }
    };
    aXHR.onerror = () => {
      theReject(new Error(aXHR.statusText));
    };
    aXHR.send();
  });
}

/* Model uses multiple external files, so requires provider to fetch it: */
/** @type {cadex.ModelData_CDXFBBufferProvider} */
function dataLoader (theModelPath, theObjId) {
  return fetchFile(modelUrl(theModelPath) + '/' + theObjId);
};

/**
 * Collect shapes id's with associated color.
 * @param {FeatureGroup} theFeatureGroup
 * @return {{color: {r: number, g: number, b: number}, ids: Array<number>}}
 */
function collectShapesIDs (theFeatureGroup) {
  const anIDs = [];
  const aColor = theFeatureGroup.color.match(/\d+/g);
  /* RGB color as {[0-1], [0-1], [0-1]}: */
  const aRGBColor = aColor
    ? {
      r: Number(aColor[0]) / 255,
      g: Number(aColor[1]) / 255,
      b: Number(aColor[2]) / 255,
    }
    : {
      r: 1,
      g: 1,
      b: 1,
    };

  function collectIDsRecursively (theObject) {
    Object.entries(theObject).forEach((theEntry) => {
      if (theEntry[0] === 'id') {
        const anID = Number(theEntry[1]);
        /* Need to add color only for the first match: */
        if (!anIDs.includes(anID)) {
          anIDs.push(anID);
        }
      }
      else if (typeof theEntry[1] === 'object') {
        collectIDsRecursively(theEntry[1]);
      }
    });
  }
  collectIDsRecursively(theFeatureGroup);

  return {
    color: aRGBColor,
    ids: anIDs,
  };
}

class SelectedEntityVisitor extends cadex.ModelPrs_SelectedEntityVisitor {
  visitPolyShapeEntity() {
    /* Method not implemented. */
  }

  visitPolyVertexEntity() {
    /* Method not implemented. */
  }

  constructor() {
    super();
    /** @type {Set<cadex.ModelData_Shape>} */
    this.selectedShapes = new Set();
  }

  /**
   * Fill the SelectedEntityVisitor selected shapes collection.
   * @override
   * @param {cadex.ModelPrs_SelectedShapeEntity} theShapeEntity
   */
  visitShapeEntity(theShapeEntity) {
    this.selectedShapes.add(theShapeEntity.shape);
  }
}

class MachiningViewer extends Viewer {
  constructor(/** @type {HTMLElement} */theElement) {
    super(theElement);

    /* Get model name from URL route of the root window: */
    const aRootWindow = window.parent || window;
    this._modelName = decodeURI(aRootWindow.location.pathname.split('/').at(-1) || 'Unnamed model');

    /** @type {CollectedPart} */
    this._selectedPart = this._collectedParts[0];
    /** @type {Set<number>} */
    this._selectedShapes = new Set();
    /** @type {Array<ProcessDataPart>} */
    this._processDataParts = [];

    /** @type {Map<cadex.ModelData_Body, cadex.ModelPrs_SceneNode>} */
    this._colorizedBodiesSceneNodes = new Map();
    /* 'Feature group name' -> {body, ids, color} */
    /** @type {Map<string, Array<{body: cadex.ModelData_Body, ids: Array<number>, color: {r: number, g: number, b: number}}>>} */
    this._colorizedBodiesCollection = new Map();

    /** @type {cadex.ModelPrs_SelectionMode} */
    this._selectionMode = cadex.ModelPrs_SelectionMode.Face | cadex.ModelPrs_SelectionMode.Edge;

    /* Add highlighting model shapes on scene on hover: */
    this._viewport.inputManager.isHoverEnabled = true;
    this._viewport.inputManager.pushInputHandler(new cadex.ModelPrs_HighlightingHandler(this._viewport));

    /* Add a handler for selection events from scene: */
    this._scene.selectionManager.addEventListener('selectionChanged', this.onSelectionChangedByScene.bind(this));

    /* Subscribe to a change in the value of the tree type selector and start loading and displaying the model again: */
    document.getElementsByName('treeTypeSelector').forEach((theRadioInputElement) => {
      theRadioInputElement.addEventListener('change', async () => await this.main());
    });
  }

  /**
   * Collect shapes from the representation by shapes IDs.
   * @param {cadex.ModelData_BRepRepresentation} theRepresentation
   * @param {Array<number>} theShapesIDs
   * @return {Promise<Array<cadex.ModelData_Shape> | undefined>}
   */
  async getShapes(theRepresentation, theShapesIDs) {
    /* Flush providers for filling representation with shapes: */
    await theRepresentation.bodyList();

    try {
      const aShapes = [];
      theShapesIDs.forEach((theShapeID) => {
        const aShape = theRepresentation.shape(theShapeID);
        if (aShape) {
          aShapes.push(aShape);
        }
      });

      return aShapes;
    }
    catch (theErr) {
      console.error('Unable to get shapes: ', theErr);
      alert(`Unable to get shapes [${/** @type {Error} */(theErr).message}]`);
    }
  }

  /**
   * Shade all representation shapes to preserve the silhouette of the model.
   * @param {cadex.ModelData_BRepRepresentation} theRepresentation
   * @param {Array<number>} theExclusionIDS
   */
  async shadeAllRepresentationShapes(theRepresentation, theExclusionIDS) {
    try {
      const anAllRepresentationBodies = await theRepresentation.bodyList();
      const aShadedFaces = [];
      /* Get all shapes excluding painted shapes: */
      for (const aBody of anAllRepresentationBodies) {
        for (const aShape of new cadex.ModelData_ShapeIterator(aBody, cadex.ModelData_ShapeType.Face)) {
          if (!theExclusionIDS.includes(theRepresentation.shapeId(aShape))) {
            aShadedFaces.push(aShape);
          }
        }
      }

      const aShadedBodyForFaces = await this.formBody(aShadedFaces);
      if (aShadedBodyForFaces) {
        const aShadedBodySceneNodeForFaces = await this.addBodyToRootPart(aShadedBodyForFaces);
        if (aShadedBodySceneNodeForFaces) {
          /* Set ghostly hidden visibility mod: */
          aShadedBodySceneNodeForFaces.displayMode = cadex.ModelPrs_DisplayMode.ShadedWithBoundaries;
          aShadedBodySceneNodeForFaces.visibilityMode = cadex.ModelPrs_VisibilityMode.GhostlyHidden;
          /* Customize color of ghostly hidden appearance: */
          const aColorizedGhostStyle = new cadex.ModelPrs_Style();
          aColorizedGhostStyle.ghostModeAppearance = new cadex.ModelData_Appearance(new cadex.ModelData_ColorObject(0.82, 0.82, 0.82, 0.6));
          aShadedBodySceneNodeForFaces.style = aColorizedGhostStyle;
          /* Update the scene to see visualization changes: */
          this._scene.update();
        }
      }
    }
    catch (theErr) {
      console.error('Unable to shade all representation shapes: ', theErr);
      alert(`Unable to shade all representation shapes [${/** @type {Error} */(theErr).message}]`);
    }
  }

  /**
   * @param {cadex.ModelPrs_SelectionChangedEvent} theEvent
   */
  onSelectionChangedByScene (theEvent) {
    /* Get a B-Rep representation of selected part: */
    const aBrepRep = this._selectedPart.representation instanceof cadex.ModelData_BRepRepresentation
      ? this._selectedPart.representation
      : this._selectedPart.sge.brepRepresentation();
    /* Shape selection is only available for BRep representation: */
    if (!aBrepRep) {
      console.error('Shape cannot be selected: The representation of the selected part is not a BRep.');
      alert('Shape cannot be selected: The representation of the selected part is not a BRep.');
      return;
    }

    /* For each unselected shape in the scene: */
    if (theEvent.removed.length > 0) {
      theEvent.removed.forEach((theSelectionItem) => {
        const aSelectedEntityVisitor = new SelectedEntityVisitor();
        for (const anEntity of theSelectionItem.entities()) {
          /* Fill the SelectedEntityVisitor selected shapes collection. */
          anEntity.accept(aSelectedEntityVisitor);
        }
        aSelectedEntityVisitor.selectedShapes.forEach((theSelectedShape) => {
          const aShapeID = aBrepRep.shapeId(theSelectedShape);
          /* Remove shape from the selected shapes collection: */
          this._selectedShapes.delete(aShapeID);
        });
      });
    }
    /* For each selected shape in the scene: */
    if (theEvent.added.length > 0) {
      theEvent.added.forEach((theSelectionItem) => {
        const aSelectedEntityVisitor = new SelectedEntityVisitor();
        for (const anEntity of theSelectionItem.entities()) {
          /* Fill the SelectedEntityVisitor selected shapes collection. */
          anEntity.accept(aSelectedEntityVisitor);
        }
        aSelectedEntityVisitor.selectedShapes.forEach((theSelectedShape) => {
          const aShapeID = aBrepRep.shapeId(theSelectedShape);
          /* Add shape to the selected shapes collection: */
          this._selectedShapes.add(aShapeID);
        });
      });
    }

    /* Clear all selections from all elements of the features tree: */
    document.querySelectorAll('[data-shape-id]').forEach((theElement) => theElement.classList.remove('feature-selected'));

    /* For each element in the selected shapes collection, add a selection to the features tree: */
    this._selectedShapes.forEach((theShapeID) => {
      const aFeaturesElements = document.querySelectorAll(`[data-shape-id~='${theShapeID}']`);
      if (aFeaturesElements.length) {
        aFeaturesElements.forEach((theElement) => {
          /* Highlight tree element. */
          theElement.classList.add('feature-selected');
          /* Open tree to element. */
          let anElementParent = theElement.parentElement;
          while (true) {
            if (anElementParent && anElementParent.tagName === 'DETAILS') {
              anElementParent.setAttribute('open', 'true');
            } else {
              break;
            }
            if (anElementParent && anElementParent.parentElement && anElementParent.parentElement.tagName === 'DETAILS') {
              anElementParent = anElementParent.parentElement;
              continue;
            }
            break;
          }
        });
        /* When selected through the viewer - scroll the tree view to this element: */
        const aFeaturesTree = document.querySelector('.tree-view-panel > details');
        if (aFeaturesTree) {
          /* offsetTop - the distance of the aFeaturesElements[0] element in relation to the top of aFeaturesTree. */
          const aTargetElement = /** @type {HTMLElement} */(aFeaturesElements[0]);
          const aFeaturesElementScrollTop = aTargetElement.offsetTop - /** @type {HTMLElement} */(aFeaturesTree).offsetTop;
          aFeaturesTree.scrollTo({
            /* Scroll to first element if there are multiple elements: */
            top: aFeaturesElementScrollTop,
            behavior: 'smooth',
          });
        }
      }
    });
  };

  /**
   * @param {MouseEvent} theEvent
   */
  onFeaturesTreeElementClick (theEvent) {
    /* Get a B-Rep representation of selected part: */
    const aBrepRep = this._selectedPart.representation instanceof cadex.ModelData_BRepRepresentation
      ? this._selectedPart.representation
      : this._selectedPart.sge.brepRepresentation();
    /* Shape selection is only available for BRep representation: */
    if (!aBrepRep) {
      console.error('Shape cannot be selected: The representation of the selected part is not a BRep.');
      alert('Shape cannot be selected: The representation of the selected part is not a BRep.');
      return;
    }

    const aTargetElement = /** @type {HTMLElement} */(theEvent.currentTarget);
    if (!aTargetElement) {
      return;
    }

    /* If there are no shapes associated with the tree element: */
    if (!aTargetElement.dataset.shapeId) {
      return;
    }
    /**
     * A collection of shape IDs associated with the clicked features tree elements.
     * @type {Array<string>}
     */
    const aShapeIDs =  aTargetElement.dataset.shapeId.split(' ');

    /* A collection of cadex.ModelData_Shape objects associated with the collection of shape IDs. */
    /** @type {Map<string, cadex.ModelData_Shape>} */
    const aTargetShapes = new Map();
    aShapeIDs.forEach((theShapeID) => {
      const aShape = aBrepRep.shape(Number(theShapeID));
      if (aShape) {
        aTargetShapes.set(theShapeID, aShape);
      }
    });
    if (!aTargetShapes.size) {
      return;
    }

    /* Clear all selections from all elements of the model on scene: */
    this._scene.selectionManager.deselectAll();
    /* Clear all selections from all elements of the features tree: */
    document.querySelectorAll('[data-shape-id]').forEach((theElement) => theElement.classList.remove('feature-selected'));

    aTargetShapes.forEach((theShape, theShapeID) => {
      /* Need for finding the target body scene node: */
      /** @type {Array<cadex.ModelData_Body>} */
      const aTargetBodies = [];
      Array.from(this._colorizedBodiesCollection.entries()).forEach((theBodiesCollectionElement) => {
        theBodiesCollectionElement[1].forEach((theCollectionValue) => {
          if (theCollectionValue.ids.includes(Number(theShapeID))) {
            aTargetBodies.push(theCollectionValue.body);
          }
        });
      });
      /* If the same shape belongs to several bodies at the same time - highlight for each body (even body is hidden): */
      aTargetBodies.forEach((theBody) => {
        /* Get target body scene node by body: */
        const aTargetBodySceneNode = this._colorizedBodiesSceneNodes.get(theBody);
        if (!aTargetBodySceneNode) {
          return;
        }

        /* Add selection on the scene: */
        const aSelectionItem = new cadex.ModelPrs_SelectionItem(
          aTargetBodySceneNode,
          new cadex.ModelPrs_SelectedShapeEntity(theShape)
        );
        this._scene.selectionManager.select(aSelectionItem, /*theBreakSelection*/false, /*theDispatchEvent*/false);
      });
    });

    /* Only add a selection to an event target tree element if the selection is from the tree: */
    aTargetElement.classList.add('feature-selected');
  };

  /**
   * Form and show the right panel of the DFM Analysis tree.
   * @param {ProcessDataPart} theProcessDataPart
   * @param {string} thePartLabel
   */
  initDFMTree (theProcessDataPart, thePartLabel) {
    const anExampleContainer = document.getElementById('example-container');
    if (!anExampleContainer) {
      return;
    }

    const aTreeViewPanel = document.querySelector('.tree-view-panel');
    if (!aTreeViewPanel) {
      return;
    }

    anExampleContainer.appendChild(aTreeViewPanel);

    /* If the process data contains error message: */
    const anErrorMessage = theProcessDataPart.error || theProcessDataPart.dfm.message;
    if (anErrorMessage) {
      const anErrorMessageElement = document.createElement('div');
      anErrorMessageElement.classList.add('error-message');
      anErrorMessageElement.innerHTML = anErrorMessage;
      aTreeViewPanel.appendChild(anErrorMessageElement);
      return;
    }

    /* Form the DFM features tree as a tree of HTML-details elements: */
    const aRootElement = document.createElement('details');
    aRootElement.setAttribute('open', 'true');
    const aRootElementSummary = document.createElement('summary');
    const aRootElementLabel = document.createElement('div');
    aRootElementLabel.classList.add('label');
    aRootElementLabel.innerHTML = thePartLabel;
    aRootElementSummary.appendChild(aRootElementLabel);
    aRootElement.appendChild(aRootElementSummary);

    /* Getting dfm data depending on the type of model: */
    const aDFMData = theProcessDataPart.dfm;
    const aFeatureGroups = aDFMData.featureGroups;
    if (!aFeatureGroups) {
      return;
    }
    aFeatureGroups.forEach((theFeatureGroup) => {
      const aFeatureGroupElement = document.createElement('details');
      aFeatureGroupElement.setAttribute('open', 'true');

      const aFeatureGroupElementSummary = document.createElement('summary');
      aFeatureGroupElement.appendChild(aFeatureGroupElementSummary);

      const aFeatureGroupElementLabel = document.createElement('div');
      aFeatureGroupElementLabel.classList.add('label');
      aFeatureGroupElementLabel.innerHTML = theFeatureGroup.name;
      aFeatureGroupElementSummary.appendChild(aFeatureGroupElementLabel);

      if (theFeatureGroup.color) {
        const aFeatureGroupElementColorSquare = document.createElement('div');
        aFeatureGroupElementColorSquare.style.backgroundColor =`rgb${theFeatureGroup.color}`;
        aFeatureGroupElementColorSquare.classList.add('color-square');
        aFeatureGroupElementSummary.appendChild(aFeatureGroupElementColorSquare);
      }

      /* If the feature group has 'features' field, then there are no subgroups: */
      if (theFeatureGroup.features) {
        theFeatureGroup.features.forEach((theFeature) => {
          /* Each feature can be associated with one or more shapes: */
          const aFeatureElement = document.createElement('span');
          if (Number(theFeature.shapeIDCount) > 0) {
            aFeatureElement.setAttribute('data-shape-id', theFeature.shapeIDs.map((theShapeID) => theShapeID.id).join(' '));
          }
          aFeatureElement.innerHTML = theFeatureGroup.name.replace('(s)', '');
          /* Calling a selection on the scene for the click event on an element of the features tree: */
          aFeatureElement.addEventListener('click', this.onFeaturesTreeElementClick.bind(this));
          aFeatureGroupElement.appendChild(aFeatureElement);
        });
      }
      else if (theFeatureGroup.subGroups) {
        theFeatureGroup.subGroups.forEach((theSubGroup) => {
          const aSubGroupElement = document.createElement('details');

          const aSubGroupElementSummary = document.createElement('summary');
          aSubGroupElement.appendChild(aSubGroupElementSummary);

          const aSubGroupElementLabel = document.createElement('div');
          aSubGroupElementLabel.classList.add('label');
          const aParametersValues = theSubGroup.parameters.map((theParameter) => isNaN(Number(theParameter.value))
            ? theParameter.value
            : Number(theParameter.value).toFixed(2));
          aSubGroupElementLabel.innerHTML = theFeatureGroup.name.replace('(s)', '') + ' (' + aParametersValues.join(', ') + ')';
          aSubGroupElementSummary.appendChild(aSubGroupElementLabel);

          theSubGroup.features.forEach((theFeature) => {
            /* Each feature can be associated with one or more shapes: */
            const aFeatureElement = document.createElement('span');
            if (Number(theFeature.shapeIDCount) > 0) {
              aFeatureElement.setAttribute('data-shape-id', theFeature.shapeIDs.map((theShapeID) => theShapeID.id).join(' '));
            }
            const aParameters = theSubGroup.parameters.map((theParameter) => `${theParameter.name} - ${isNaN(Number(theParameter.value)) ? theParameter.value : Number(theParameter.value).toFixed(2)} ${theParameter.units}`).join(', ');
            aFeatureElement.innerHTML = aParameters;
            /* Calling a selection on the scene for the click event on an element of the features tree: */
            aFeatureElement.addEventListener('click', this.onFeaturesTreeElementClick.bind(this));
            aSubGroupElement.appendChild(aFeatureElement);
          });

          aFeatureGroupElement.appendChild(aSubGroupElement);
        });
      }

      aRootElement.appendChild(aFeatureGroupElement);
    });

    aTreeViewPanel.appendChild(aRootElement);
  }

  /**
   * Form and show the right panel of the Features tree.
   * @param {ProcessDataPart} theProcessDataPart
   * @param {string} thePartLabel
   */
  initFeaturesTree (theProcessDataPart, thePartLabel) {
    const anExampleContainer = document.getElementById('example-container');
    if (!anExampleContainer) {
      return;
    }

    const aTreeViewPanel = document.querySelector('.tree-view-panel');
    if (!aTreeViewPanel) {
      return;
    }

    anExampleContainer.appendChild(aTreeViewPanel);

    /* If the process data contains error message: */
    const anErrorMessage = theProcessDataPart.error || theProcessDataPart.featureRecognition.message;
    if (anErrorMessage) {
      const anErrorMessageElement = document.createElement('div');
      anErrorMessageElement.classList.add('error-message');
      anErrorMessageElement.innerHTML = anErrorMessage;
      aTreeViewPanel.appendChild(anErrorMessageElement);
      return;
    }

    /* Form the Features tree as a tree of HTML-details elements: */
    const aRootElement = document.createElement('details');
    aRootElement.setAttribute('open', 'true');
    const aRootElementSummary = document.createElement('summary');
    const aRootElementLabel = document.createElement('div');
    aRootElementLabel.classList.add('label');
    aRootElementLabel.innerHTML = thePartLabel;
    aRootElementSummary.appendChild(aRootElementLabel);
    aRootElement.appendChild(aRootElementSummary);

    const aFeatureGroups = theProcessDataPart.featureRecognition.featureGroups;
    if (!aFeatureGroups) {
      return;
    }
    aFeatureGroups.forEach((theFeatureGroup) => {
      const aFeatureGroupElement = document.createElement('details');
      aFeatureGroupElement.setAttribute('open', 'true');

      const aFeatureGroupElementSummary = document.createElement('summary');
      aFeatureGroupElement.appendChild(aFeatureGroupElementSummary);

      const aFeatureGroupElementLabel = document.createElement('div');
      aFeatureGroupElementLabel.classList.add('label');
      aFeatureGroupElementLabel.innerHTML = theFeatureGroup.name;
      aFeatureGroupElementSummary.appendChild(aFeatureGroupElementLabel);

      if (theFeatureGroup.color) {
        const aFeatureGroupElementColorSquare = document.createElement('div');
        aFeatureGroupElementColorSquare.style.backgroundColor =`rgb${theFeatureGroup.color}`;
        aFeatureGroupElementColorSquare.classList.add('color-square');
        aFeatureGroupElementSummary.appendChild(aFeatureGroupElementColorSquare);
      }

      /* If the feature group has 'features' field, then there are no subgroups: */
      if (theFeatureGroup.features) {
        theFeatureGroup.features.forEach((theFeature) => {
          /* Each feature can be associated with one or more shapes: */
          const aFeatureElement = document.createElement('span');
          if (Number(theFeature.shapeIDCount) > 0) {
            aFeatureElement.setAttribute('data-shape-id', theFeature.shapeIDs.map((theShapeID) => theShapeID.id).join(' '));
          }
          aFeatureElement.innerHTML = theFeatureGroup.name.replace('(s)', '');
          /* Calling a selection on the scene for the click event on an element of the features tree: */
          aFeatureElement.addEventListener('click', this.onFeaturesTreeElementClick.bind(this));
          aFeatureGroupElement.appendChild(aFeatureElement);
        });
      }
      else if (theFeatureGroup.subGroups) {
        theFeatureGroup.subGroups.forEach((theSubGroup) => {
          const aSubGroupElement = document.createElement('details');

          const aSubGroupElementSummary = document.createElement('summary');
          aSubGroupElement.appendChild(aSubGroupElementSummary);

          const aSubGroupElementLabel = document.createElement('div');
          aSubGroupElementLabel.classList.add('label');
          const aParametersValues = theSubGroup.parameters.map((theParameter) => isNaN(Number(theParameter.value))
            ? theParameter.value
            : Number(theParameter.value).toFixed(2));
          aSubGroupElementLabel.innerHTML = theFeatureGroup.name.replace('(s)', '') + ' (' + aParametersValues.join(', ') + ')';
          aSubGroupElementSummary.appendChild(aSubGroupElementLabel);

          theSubGroup.features.forEach((theFeature) => {
            /* Each feature can be associated with one or more shapes: */
            const aFeatureElement = document.createElement('span');
            if (Number(theFeature.shapeIDCount) > 0) {
              aFeatureElement.setAttribute('data-shape-id', theFeature.shapeIDs.map((theShapeID) => theShapeID.id).join(' '));
            }
            const aParameters = theSubGroup.parameters.map((theParameter) => `${theParameter.name} - ${isNaN(Number(theParameter.value)) ? theParameter.value : Number(theParameter.value).toFixed(2)} ${theParameter.units}`).join(', ');
            aFeatureElement.innerHTML = aParameters;
            /* Calling a selection on the scene for the click event on an element of the features tree: */
            aFeatureElement.addEventListener('click', this.onFeaturesTreeElementClick.bind(this));
            aSubGroupElement.appendChild(aFeatureElement);
          });

          aFeatureGroupElement.appendChild(aSubGroupElement);
        });
      }

      aRootElement.appendChild(aFeatureGroupElement);
    });

    aTreeViewPanel.appendChild(aRootElement);
  }

  /**
   * Form and show button for downloading JSON file with model data.
   */
  initExportJSON () {
    const aPathToModelFolder = `/static/data/examples/machining/${this._modelName}`;
    const aTreeViewPanel = document.querySelector('.tree-view-panel');
    if (!aTreeViewPanel) {
      return;
    }

    const anExportJSONButton = document.createElement('a');
    anExportJSONButton.href = `${aPathToModelFolder}/process_data.json`;
    anExportJSONButton.download = `${aPathToModelFolder.split('/').at(-1)}.json`;
    anExportJSONButton.classList.add('export-json-button');
    anExportJSONButton.innerHTML = 'Export JSON';

    aTreeViewPanel.appendChild(anExportJSONButton);
  }

  /**
   * Form and show features selector.
   * @param {Array<FeatureGroup>} theFeatureGroups
   */
  async initFeaturesSelector (theFeatureGroups) {
    if (!theFeatureGroups.length) {
      return;
    }

    /* Form features selector: */
    const aFeaturesSelector = document.createElement('select');
    aFeaturesSelector.classList.add('features-selector');
    const anAllOption = document.createElement('option');
    anAllOption.value = 'All Features';
    anAllOption.text = 'All Features';
    aFeaturesSelector.appendChild(anAllOption);
    theFeatureGroups.forEach((theFeatureGroup) => {
      const theFeatureName = theFeatureGroup.name;
      const anOption = document.createElement('option');
      anOption.value = theFeatureName;
      anOption.text = theFeatureName;
      aFeaturesSelector.appendChild(anOption);
    });

    /* Add onChange event listener: */
    aFeaturesSelector.addEventListener('change', async (theEvent) => {
      const aTargetElement = /** @type {HTMLSelectElement} */(theEvent.target);
      /** @type {Map<cadex.ModelData_Body, {r: number, g: number, b: number}>} */
      const aTargetBodies = new Map();
      const aTargetBodiesCollection = [];

      if (aTargetElement.value === 'All Features') {
        document.querySelectorAll('.tree-view-panel > details > details').forEach((theElement) => theElement.classList.remove('hidden'));
        theFeatureGroups.forEach((theFeatureGroup) => {
          const aColorizedBodiesCollectionElement = this._colorizedBodiesCollection.get(theFeatureGroup.name);
          if (aColorizedBodiesCollectionElement) {
            aColorizedBodiesCollectionElement.forEach((theBodyCollectionElement) => aTargetBodiesCollection.push(theBodyCollectionElement));
          }
        });
      }
      else {
        document.querySelectorAll('.tree-view-panel > details > details').forEach((theElement) => theElement.classList.add('hidden'));
        const aTargetSummary = Array.prototype.slice.call(document.getElementsByTagName('summary')).filter((theElement) => theElement.textContent.trim() === aTargetElement.value.trim())[0];
        const aTargetDetails = aTargetSummary.parentElement;
        aTargetDetails.classList.remove('hidden');

        const aSelectedFeatureName = aTargetElement.value;
        const aColorizedBodiesCollectionElement = this._colorizedBodiesCollection.get(aSelectedFeatureName);
        if (aColorizedBodiesCollectionElement) {
          aColorizedBodiesCollectionElement.forEach((theBodyCollectionElement) => aTargetBodiesCollection.push(theBodyCollectionElement));
        }
      }

      for (const aTargetBodiesCollectionElement of aTargetBodiesCollection) {
        aTargetBodies.set(aTargetBodiesCollectionElement.body, aTargetBodiesCollectionElement.color);
      }

      await this.removeRootPart();
      await this.addRootPart(
        this._selectedPart.sge,
        this._selectionMode,
      );

      /* Clear bodies scene nodes collections for every feature selector change: */
      this._colorizedBodiesSceneNodes.clear();
      /* Show colorized selected features on the scene: */
      for (const theBody of aTargetBodies.entries()) {
        const aBodySceneNode = await this.addBodyToRootPart(theBody[0], theBody[1]);
        if (aBodySceneNode) {
          this._colorizedBodiesSceneNodes.set(theBody[0], aBodySceneNode);
        }
      }

      /* Shade all representation shapes to preserve the silhouette of the model: */
      const aBRepRepresentation = this._selectedPart.representation instanceof cadex.ModelData_BRepRepresentation
        ? this._selectedPart.representation
        : this._selectedPart.sge.brepRepresentation();
      if (aBRepRepresentation) {
        /* Shade all other representation shapes: */
        const aColorizedShapesIDs = aTargetBodiesCollection.reduce((thePrev, theCurr) => {
          theCurr.ids.forEach((/** @type {number} */theID) => thePrev.push(theID));
          return thePrev;
        }, /** @type {Array<number>} */([]));
        await this.shadeAllRepresentationShapes(aBRepRepresentation, aColorizedShapesIDs);
      }
    });

    /* Add features selector on tree-view-panel after tree-type-selector: */
    const aTreeTypeSelector = document.querySelector('.tree-type-selector');
    if (aTreeTypeSelector) {
      const aParent = aTreeTypeSelector.parentNode;
      if (aParent) {
        aParent.insertBefore(aFeaturesSelector, aTreeTypeSelector.nextSibling);
      }
    }
  }

  /**
   * Form and show model parts selector.
   * @param {!Array<string>} theParts
   * @param {string} theDefaultValue
   */
  initPartsSelector (theParts, theDefaultValue) {
    /* Clean up the previous selector: */
    const aPreviousPartsSelector = document.querySelector('.part-selector');
    if (aPreviousPartsSelector) {
      aPreviousPartsSelector.remove();
    }

    const anExampleContainer = document.getElementById('example-container');
    if (!anExampleContainer) {
      return;
    }

    const aPartsSelector = document.createElement('select');
    aPartsSelector.classList.add('part-selector');
    theParts.forEach((thePart) => {
      const anOption = document.createElement('option');
      anOption.value = thePart;
      anOption.text = thePart;
      if (thePart === theDefaultValue) {
        anOption.setAttribute('selected', 'true');
      }
      aPartsSelector.appendChild(anOption);
    });

    aPartsSelector.addEventListener('change', async (theEvent) => {
      await this.onSelectedPartChange(/** @type {HTMLSelectElement} */(theEvent.target));
    });

    anExampleContainer.appendChild(aPartsSelector);
  }

  /**
   * Rerender the viewer every time the selector value (selected part) changes.
   * @param {HTMLSelectElement} theElement The target HTML element.
   */
  async onSelectedPartChange (theElement) {
    /* Clean up scene to display new part: */
    await this.removeRootPart();

    /* Clear bodies and bodies scene nodes collections for every part change: */
    this._colorizedBodiesCollection.clear();
    this._colorizedBodiesSceneNodes.clear();

    /* Clean up the previous DFM features tree: */
    const aPrevTreeElement = document.querySelector('.tree-view-panel details');
    if (aPrevTreeElement) {
      aPrevTreeElement.remove();
    }
    /* Clean up the unfolded features tab if exists: */
    const anUnfoldedFeaturesTab = document.querySelector('.tree-view-panel .unfolded-features');
    if (anUnfoldedFeaturesTab) {
      anUnfoldedFeaturesTab.remove();
    }
    /* Clean up error message if exists: */
    const anErrorMessageElement = document.querySelector('.tree-view-panel .error-message');
    if (anErrorMessageElement) {
      anErrorMessageElement.remove();
    }
    /* Clean up the previous selector: */
    const aPreviousFeatureSelector = document.querySelector('.features-selector');
    if (aPreviousFeatureSelector) {
      aPreviousFeatureSelector.remove();
    }
    /* Clean up the previous export JSON button: */
    const aPreviousExportJSONButton = document.querySelector('.export-json-button');
    if (aPreviousExportJSONButton) {
      aPreviousExportJSONButton.remove();
    }

    this._selectedPart = this._collectedParts.find((theCollectedPart) => theCollectedPart.label === theElement.value);
    const aProcessDataPart = this._processDataParts.find((thePart) => thePart.partId === this._selectedPart.id);

    if (!aProcessDataPart) {
      console.error(`Unable to find part data for [${this._selectedPart.label}]`);
      alert(`Unable to find part data for [${this._selectedPart.label}]`);
      return;
    }

    const isFeaturesTreeSelected = /** @type {HTMLLabelElement} */(document.querySelector('.tree-type-selector input:checked + label')).innerText === 'Features';

    const aColorizedFeatureGroups = (
      isFeaturesTreeSelected
        ? aProcessDataPart.featureRecognition.featureGroups
        : aProcessDataPart.dfm.featureGroups
    ) || [];

    /* Form and show features selector: */
    await this.initFeaturesSelector(aColorizedFeatureGroups);

    /* Recognize the choice of tree view panel type through the label of the selected radio input: */
    isFeaturesTreeSelected
      /* Form and show the right panel of the Features tree: */
      ? this.initFeaturesTree(aProcessDataPart, this._selectedPart.label)
      /* Form and show the right panel of the DFM features tree: */
      : this.initDFMTree(aProcessDataPart, this._selectedPart.label);

    this.initExportJSON();

    await this.addRootPart(
      this._selectedPart.sge,
      this._selectionMode,
    );

    const aBRepRepresentation = this._selectedPart.representation instanceof cadex.ModelData_BRepRepresentation
      ? this._selectedPart.representation
      : this._selectedPart.sge.brepRepresentation();

    if (aBRepRepresentation) {
      /* Collect and colorize target bodies. */
      for (const theFeatureGroup of aColorizedFeatureGroups)  {
        const collectedShapesIDs = collectShapesIDs(theFeatureGroup);
        const aColorizedShapes = await this.getShapes(aBRepRepresentation, collectedShapesIDs.ids);

        if (aColorizedShapes) {
          const aShapesTypes = new Set();
          /* Get shape types: */
          aColorizedShapes.forEach((theShape) => aShapesTypes.add(theShape.type));

          /** @type {Map<cadex.ModelData_Body, Array<number>>} */
          const aColorizedBodies = new Map();

          for (const aType of aShapesTypes) {
            /* Get the shapes by type: */
            const aTypedShapes = aColorizedShapes.filter((theShape) => theShape.type === aType);
            /** @type {Set<number>} */
            const aTypedShapesIDs = new Set();
            /* Get the own id's for the typed shapes:*/
            aTypedShapes.forEach((theShape) => {
              const aShapeID = aBRepRepresentation.shapeId(theShape);
              if (aShapeID !== -1) {
                aTypedShapesIDs.add(aShapeID);
              }
            });

            /* Form a body from type-specific shapes: */
            const aColorizedBody = await this.formBody(aTypedShapes);
            if (aColorizedBody) {
              aColorizedBodies.set(aColorizedBody, Array.from(aTypedShapesIDs));
            }
          }

          /* Fill the bodies collection with bodies and them own id's: */
          this._colorizedBodiesCollection.set(
            theFeatureGroup.name,
            Array.from(aColorizedBodies).map(
              (theBody) => ({body: theBody[0], ids: theBody[1], color: collectedShapesIDs.color})
            ),
          );

          for (const aColorizedBody of aColorizedBodies.keys()) {
            const aBodySceneNode = await this.addBodyToRootPart(aColorizedBody, collectedShapesIDs.color);
            if (aBodySceneNode) {
              this._colorizedBodiesSceneNodes.set(aColorizedBody, aBodySceneNode);
            }
          }
        }
      }

      /* Shade all other representation shapes: */
      const aColorizedShapesIDs = Array.from(this._colorizedBodiesCollection.values()).reduce((thePrev, theCurr) => {
        theCurr.forEach((theBodiesCollectionElement) => theBodiesCollectionElement.ids.forEach((theID) => thePrev.push(theID)));
        return thePrev;
      }, /** @type {Array<number>} */([]));
      await this.shadeAllRepresentationShapes(aBRepRepresentation, aColorizedShapesIDs);
    }
  }

  async main () {
    /* Get MTK data of the converted model as JSON object: */
    this._processDataParts = (await fetchProcessData(this._modelName)).parts;

    await this.loadModel(dataLoader, this._modelName);

    this._selectedPart = this._collectedParts[0];

    /* Form and show model parts selector: */
    this.initPartsSelector(this._collectedParts.reduce((prev, curr) => {
      prev.push(curr.label);
      return prev;
    }, []), this._selectedPart.label);

    const aPartsSelector = /** @type {HTMLSelectElement} */ (document.querySelector('.part-selector'));
    if (aPartsSelector) {
      await this.onSelectedPartChange(aPartsSelector);
    }
  }
}

const aFileViewerElement = document.getElementById('file-viewer');
if (aFileViewerElement) {
  const aViewer = new MachiningViewer(aFileViewerElement);
  aViewer.main();
}
