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

import { fetchFile, modelUrl, fetchProcessData, isUnfoldedModelExists } from '/javascripts/helpers.mjs';
import cadex from '@cadexchanger/web-toolkit';

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
 * @typedef ProcessDataForFeaturesUnfolded
 * @property {string} name section name
 * @property {string | undefined} parametersCount overall parameters count found by feature recognition for unfolded model
 * @property {Array<Parameter> | undefined} parameters list of all found parameters
 * @property {string | undefined} message
 */

/**
 * @typedef FeaturesInfo
 * @property {string} partId ID of the corresponding part of model
 * @property {string} process name of the usd process
 * @property {string} error error message if conversion failed
 * @property {ProcessData} dfm section with dfm analysis information
 * @property {ProcessData} featureRecognition section with feature recognition information
 * @property {ProcessData} dfmUnfolded section with dfm analysis information for unfolded model
 * @property {ProcessDataForFeaturesUnfolded} featureRecognitionUnfolded section with feature recognition information for unfolded model
 */

/**
 * @typedef CollectedPart
 * @property {string} id
 * @property {string} label
 * @property {cadex.ModelData_Part} sge
 * @property {cadex.ModelData_Representation} representation
 * @property {FeaturesInfo} featuresInfo
 */

class CustomSGEVisitor extends cadex.ModelData_SceneGraphElementVisitor {
  /**
   * @param {Object} theProcessData MTK data of the converted model as JSON object. Filled by json from fetchProcessData.
   * @param {cadex.ModelData_RepresentationMask} theRepMask Defines a mask to filter part representations. Filter any representation by default.
   */
  constructor(theProcessData, theRepMask = cadex.ModelData_RepresentationMask.ModelData_RM_Any) {
    super();
    this.processData = Object.assign({}, theProcessData);
    this.repMask = theRepMask;
    /**
     * @type {Array<CollectedPart>}
     */
    this.collectedParts = [];
  }

  /**
   * @param {cadex.ModelData_RepresentationMask} theRepMask
   */
  updateRepMask(theRepMask) {
    this.repMask = theRepMask;
    this.collectedParts.forEach((theCollectedPart) => theCollectedPart.representation = theCollectedPart.sge.representation(theRepMask));
  }

  /**
   * Clear the CustomSGEVisitor collected parts collection.
   */
  clear() {
    this.collectedParts = [];
  }

  /**
   * Fill the CustomSGEVisitor collected parts collection by the data of the each part of model.
   * @override
   * @param {!cadex.ModelData_Part} thePart
   */
  visitPart(thePart) {
    const aPartID = thePart.uuid?.toString() || '';
    /* Only unique parts (not all instances) should be present in the part selection drop-down list: */
    if (!this.collectedParts.find((theCollectedPart) => theCollectedPart.sge === thePart)) {
      this.collectedParts.push({
        id: aPartID,
        label: thePart.name || 'Unnamed part',
        sge: thePart,
        representation: thePart.representation(this.repMask),
        /* MTK data of the converted model associated with the part: */
        featuresInfo: this.processData.parts.find((theProcessDataPart) => theProcessDataPart.partId === aPartID),
      });
    }
  }
}

class SelectedEntityVisitor extends cadex.ModelPrs_SelectedEntityVisitor {
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

/* The main class of the example. */
class MTKExample {
  /**
   * @param {string} theModelName Transmitted using URL route.
   * @param {Object} theProcessData MTK data of the converted model as JSON object. Filled by json from fetchProcessData.
   */
  constructor(theModelName, theProcessData) {
    /** @type {string} */
    this.modelName = theModelName;
    /** @type {CustomSGEVisitor} */
    this.customSGEVisitor = new CustomSGEVisitor(theProcessData);
    /** @type {Set<number>} */
    this.selectedShapes = new Set();
    /** @type {CollectedPart | null} */
    this.selectedPart = null;
    /** @type {cadex.ModelPrs_SceneNode | null} */
    this.rootRepresentationNode = null;
    /** @type {boolean} */
    this.isModelUnfolded = false;

    /* Subscribe to a change in the value of the tree type selector and start loading and displaying the model again: */
    document.getElementsByName('treeTypeSelector').forEach((theRadioInputElement) => {
      theRadioInputElement.addEventListener('change', () => this.loadAndDisplayModel());
    });

    /* The model object is from a file in native CAD Exchanger format (see the docs for a detailed description): */
    this.model = new cadex.ModelData_Model();

    /* The scene for visualization: */
    this.scene = new cadex.ModelPrs_Scene();

    /* Add a handler for selection events from scene: */
    this.scene.selectionManager.addEventListener('selectionChanged', this.onSelectionChangedByScene);

    /* The viewport for visualization. Initializing with default config and element attach to. */
    this.viewport = new cadex.ModelPrs_ViewPort({}, /** @type {HTMLElement} */(document.getElementById('file-viewer')));
    /* Attach viewport to scene to render content of */
    this.viewport.attachToScene(this.scene);

    /* Add highlighting model shapes on scene on hover: */
    this.viewport.inputManager.isHoverEnabled = true;
    this.viewport.inputManager.pushInputHandler(new cadex.ModelPrs_HighlightingHandler(this.viewport));
  }

  /**
   * Load and display the model on the scene.
   */
  loadAndDisplayModel = async () => {
    try {
      /* Clean up scene to display new model: */
      this.scene.clear();
      await this.scene.update();

      /* Recognize the choice of model type through the label of the selected radio input: */
      this.isModelUnfolded = !(/** @type {HTMLLabelElement} */(document.querySelector('.model-type-selector input:checked + label')).innerText === 'Original part');

      /* If there is situation when <model_name>_unfolded.cdxfb is not generated: */
      const aShowEmptyUnfoldedModel = this.isModelUnfolded ? !(await isUnfoldedModelExists(this.modelName)) : false;

      /* Model uses multiple external files, so requires provider to fetch it: */
      /** @type {cadex.ModelData_CDXFBBufferProvider} */
      const dataLoader = (theModelPath, theObjId) => {
        return fetchFile(modelUrl(theModelPath, this.isModelUnfolded && !aShowEmptyUnfoldedModel) + '/' + theObjId);
      };

      /* Load model by URL: */
      const aLoadResult = await this.model.loadFile(this.modelName, dataLoader, false /*append roots*/);
      console.log(`${this.modelName} is loaded\n`, aLoadResult);

      /* If the loaded model contains a B-Rep representation for at least one part then define a BRep mask to filter part representations: */
      const aRepMask = aLoadResult.hasBRepRep ? cadex.ModelData_RepresentationMask.ModelData_RM_BRep : cadex.ModelData_RepresentationMask.ModelData_RM_Poly;

      /* Change representation mask for CustomSGEVisitor: */
      this.customSGEVisitor.clear();
      this.customSGEVisitor.updateRepMask(aRepMask);

      /* Fill the CustomSGEVisitor collected parts collection by the data of the each part of model:  */
      await this.model.accept(this.customSGEVisitor);

      /* Get the selected part: */
      const aPartsSelectElement = document.querySelector('#example-container select');
      this.selectedPart = aPartsSelectElement
        ? this.customSGEVisitor.collectedParts.find((theCollectedPart) => theCollectedPart.label === aPartsSelectElement.value)
        : this.customSGEVisitor.collectedParts[0];

      if (this.selectedPart) {
        /* Recognize the choice of tree view panel type through the label of the selected radio input: */
        /** @type {HTMLLabelElement} */(document.querySelector('.tree-type-selector input:checked + label')).innerText === 'Features'
          /* Form and show the right panel of the Features tree: */
          ? this.initFeaturesTree(this.selectedPart)
          /* Form and show the right panel of the DFM features tree: */
          : this.initDFMTree(this.selectedPart);
      } else {
        throw new Error('Unable to find target part from model.');
      }
      /* Form and show model parts selector: */
      this.initPartsSelector(this.customSGEVisitor.collectedParts.reduce((prev, curr) => {
        prev.push(curr.label);
        return prev;
      }, []), this.selectedPart.label);
      /** @type {HTMLSelectElement} */

      if (!aShowEmptyUnfoldedModel) {
        /* Create visualization graph for model: */
        const aSceneNodeFactory = new cadex.ModelPrs_SceneNodeFactory();
        const aSceneNode = aSceneNodeFactory.createNodeFromSceneGraphElement(this.selectedPart.sge);
        this.rootRepresentationNode = aSceneNodeFactory.createNodeFromRepresentation(this.selectedPart.representation);
        aSceneNode.addChildNode(this.rootRepresentationNode);

        if (!aSceneNode) {
          throw new Error('Unable to create scene node from model.');
        }

        /* Set display mode for visualization: */
        aSceneNode.displayMode = aLoadResult.hasBRepRep ? cadex.ModelPrs_DisplayMode.ShadedWithBoundaries : cadex.ModelPrs_DisplayMode.Shaded;
        /* Set selection by face mode and by edge mode for visualization: */
        aSceneNode.selectionMode = cadex.ModelPrs_SelectionMode.Face | cadex.ModelPrs_SelectionMode.Edge;

        /* Add visualization graph for model to scene: */
        this.scene.addRoot(aSceneNode);

        /* Update the scene to see visualization changes: */
        await this.scene.update();

        /* Finally move camera to position when the whole model is in sight: */
        this.viewport.fitAll();
      }
    }
    catch (theErr) {
      console.error('Unable to load and display model: ', theErr);
      alert(`Unable to load model "${this.modelName}" [${/** @type {Error} */(theErr).message}]`);
    }
  }

  /**
   * @param {cadex.ModelPrs_SelectionChangedEvent} theEvent
   */
  onSelectionChangedByScene = (theEvent) => {
    /* Get a B-Rep representation of selected part: */
    const aBrepRep = this.selectedPart.sge.brepRepresentation();

    /* For each unselected shape in the scene: */
    if (theEvent.removed.length > 0) {
      if (aBrepRep) {
        theEvent.removed.forEach((theSelectionItem) => {
          const aSelectedEntityVisitor = new SelectedEntityVisitor();
          for (const anEntity of theSelectionItem.entities()) {
            /* Fill the SelectedEntityVisitor selected shapes collection. */
            anEntity.accept(aSelectedEntityVisitor);
          }
          aSelectedEntityVisitor.selectedShapes.forEach((theSelectedShape) => {
            const aShapeID = aBrepRep.shapeId(theSelectedShape);
            /* Remove shape from the selected shapes collection: */
            this.selectedShapes.delete(aShapeID);
          });
        });
      }
    }
    /* For each selected shape in the scene: */
    if (theEvent.added.length > 0) {
      if (aBrepRep) {
        theEvent.added.forEach((theSelectionItem) => {
          const aSelectedEntityVisitor = new SelectedEntityVisitor();
          for (const anEntity of theSelectionItem.entities()) {
            /* Fill the SelectedEntityVisitor selected shapes collection. */
            anEntity.accept(aSelectedEntityVisitor);
          }
          aSelectedEntityVisitor.selectedShapes.forEach((theSelectedShape) => {
            const aShapeID = aBrepRep.shapeId(theSelectedShape);
            /* Add shape to the selected shapes collection: */
            this.selectedShapes.add(aShapeID);
          });
        });
      }
    }

    /* Clear all selections from all elements of the features tree: */
    document.querySelectorAll('[data-shape-id]').forEach((theElement) => theElement.classList.remove('feature-selected'));

    /* For each element in the selected shapes collection, add a selection to the features tree: */
    this.selectedShapes.forEach((theShapeID) => {
      const aFeaturesElements = document.querySelectorAll(`[data-shape-id~='${theShapeID}']`);
      if (aFeaturesElements.length) {
        aFeaturesElements.forEach((theElement) => {
          /* Highlight tree element. */
          theElement.classList.add('feature-selected');
          /* Open tree to element. */
          let anElementParent = theElement.parentElement;
          while (true) {
            if (anElementParent.tagName === 'DETAILS') {
              anElementParent.setAttribute('open', true);
            } else {
              break;
            }
            if (anElementParent.parentElement.tagName === 'DETAILS') {
              anElementParent = anElementParent.parentElement;
              continue;
            }
            break;
          }
        });
        /* When selected through the viewer - scroll the tree view to this element: */
        const aFeaturesTree = document.querySelector('.tree-view-panel > details');
        const aFeaturesElementScrollTop = aFeaturesElements[0].offsetTop - (aFeaturesElements[0].clientHeight * 2); /* offsetTop - the distance of the aFeaturesElements[0] element in relation to the top of aFeaturesTree. */
        aFeaturesTree.scrollTo({
          /* Scroll to first element if there are multiple elements: */
          top: aFeaturesElementScrollTop,
          behavior: 'smooth',
        });
      }
    });
  };

  /**
   * @param {MouseEvent} theEvent
   */
  onFeaturesTreeElementClick = (theEvent) => {
    const aBrepRep = this.selectedPart.representation;
    /* Shape selection is only available for BRep representation: */
    if (!(aBrepRep instanceof cadex.ModelData_BRepRepresentation)) {
      console.error('Shape cannot be selected: The representation of the selected part is not a BRep.');
      alert('Shape cannot be selected: The representation of the selected part is not a BRep.');
      return;
    }

    /* If there are no shapes associated with the tree element: */
    if (!theEvent.currentTarget.dataset.shapeId) {
      return;
    }
    /**
     * A collection of shape IDs associated with the clicked features tree elements.
     * @type {Array<string>}
     */
    const aShapeIDs =  theEvent.currentTarget.dataset.shapeId.split(' ');

    /* A collection of cadex.ModelData_Shape objects associated with the collection of shape IDs. */
    const aTargetShapes = aShapeIDs.map((theShapeID) => {
      const aShape = aBrepRep.shape(theShapeID);
      if (aShape) {
        return aShape;
      }
    });
    if (!aTargetShapes.length) {
      return;
    }

    /* Clear all selections from all elements of the model on scene: */
    this.scene.selectionManager.deselectAll();
    /* Clear all selections from all elements of the features tree: */
    document.querySelectorAll('[data-shape-id]').forEach((theElement) => theElement.classList.remove('feature-selected'));

    aTargetShapes.forEach((theShape) => {
      /* Add selection on the scene: */
      const aSelectionItem = new cadex.ModelPrs_SelectionItem(this.rootRepresentationNode, new cadex.ModelPrs_SelectedShapeEntity(theShape));
      this.scene.selectionManager.select(aSelectionItem, /*theBreakSelection*/false, /*theDispatchEvent*/false);
    });

    /* Only add a selection to an event target tree element if the selection is from the tree: */
    theEvent.currentTarget.classList.add('feature-selected');
  };

  /**
   * Form and show model parts selector.
   * @param {!Array<string>} theParts
   * @param {string} theDefaultValue
   */
  initPartsSelector = (theParts, theDefaultValue) => {
    /* Clean up the previous part selector: */
    const aPrevTree = document.querySelector('#example-container select');
    if (aPrevTree) {
      aPrevTree.remove();
    }

    const anExampleContainer = document.getElementById('example-container');

    const aPartsSelector = document.createElement('select');
    theParts.forEach((thePart) => {
      const anOption = document.createElement('option');
      anOption.value = thePart;
      anOption.text = thePart;
      if (thePart === theDefaultValue) {
        anOption.setAttribute('selected', true);
      }
      aPartsSelector.appendChild(anOption);
    });
    /* Load and display the model every time the selector value changes: */
    aPartsSelector.addEventListener('change', () => this.loadAndDisplayModel());
    anExampleContainer.appendChild(aPartsSelector);
  }

  /**
   * Form and show the right panel of the DFM Analysis tree.
   * @param {CollectedPart} theCollectedPart
   */
  initDFMTree = (theCollectedPart) => {
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
    const anErrorMessageElement = document.querySelector('.tree-view-panel .error-message');
    if (anErrorMessageElement) {
      anErrorMessageElement.remove();
    }

    const anExampleContainer = document.getElementById('example-container');
    const aTreeViewPanel = document.querySelector('.tree-view-panel');
    anExampleContainer.appendChild(aTreeViewPanel);

    /* If the process data contains error message: */
    const anErrorMessage = theCollectedPart.featuresInfo.error || (
      this.isModelUnfolded
        ? theCollectedPart.featuresInfo.featureRecognitionUnfolded.message || theCollectedPart.featuresInfo.dfmUnfolded.message
        : theCollectedPart.featuresInfo.dfm.message
      );
    if (anErrorMessage) {
      const anErrorMessageElement = document.createElement('div');
      anErrorMessageElement.classList.add('error-message');
      anErrorMessageElement.innerHTML = anErrorMessage;
      aTreeViewPanel.appendChild(anErrorMessageElement);
    }
    /* Form the DFM features tree as a tree of HTML-details elements: */
    else {
      const aRootElement = document.createElement('details');
      aRootElement.setAttribute('open', true)
      const aRootElementLabel = document.createElement('summary');
      aRootElementLabel.innerHTML = theCollectedPart.label;
      aRootElement.appendChild(aRootElementLabel);

      /* Getting dfm data depending on the type of model: */
      const aDFMData = this.isModelUnfolded ? theCollectedPart.featuresInfo.dfmUnfolded : theCollectedPart.featuresInfo.dfm;
      aDFMData.featureGroups.forEach((theFeatureGroup) => {
        const aFeatureGroupElement = document.createElement('details');
        aFeatureGroupElement.setAttribute('open', true);
        const aFeatureGroupElementLabel = document.createElement('summary');
        aFeatureGroupElementLabel.innerHTML = theFeatureGroup.name;
        aFeatureGroupElement.appendChild(aFeatureGroupElementLabel);

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
            aFeatureElement.addEventListener('click', this.onFeaturesTreeElementClick);
            aFeatureGroupElement.appendChild(aFeatureElement);
          });
        }
        else if (theFeatureGroup.subGroups) {
          theFeatureGroup.subGroups.forEach((theSubGroup) => {
            const aSubGroupElement = document.createElement('details');
            const aSubGroupElementLabel = document.createElement('summary');
            const aParametersValues = theSubGroup.parameters.map((theParameter) => isNaN(theParameter.value) ? theParameter.value : Number(theParameter.value).toFixed(2));
            aSubGroupElementLabel.innerHTML = theFeatureGroup.name.replace('(s)', '') + ' (' + aParametersValues.join(', ') + ')';
            aSubGroupElement.appendChild(aSubGroupElementLabel);

            theSubGroup.features.forEach((theFeature) => {
              /* Each feature can be associated with one or more shapes: */
              const aFeatureElement = document.createElement('span');
              if (Number(theFeature.shapeIDCount) > 0) {
                aFeatureElement.setAttribute('data-shape-id', theFeature.shapeIDs.map((theShapeID) => theShapeID.id).join(' '));
              }
              const aParameters = theSubGroup.parameters.map((theParameter) => `${theParameter.name} - ${isNaN(theParameter.value) ? theParameter.value : Number(theParameter.value).toFixed(2)} ${theParameter.units}`).join(', ');
              aFeatureElement.innerHTML = aParameters;
              /* Calling a selection on the scene for the click event on an element of the features tree: */
              aFeatureElement.addEventListener('click', this.onFeaturesTreeElementClick);
              aSubGroupElement.appendChild(aFeatureElement);
            });

            aFeatureGroupElement.appendChild(aSubGroupElement);
          });
        }

        aRootElement.appendChild(aFeatureGroupElement);
      });

      aTreeViewPanel.appendChild(aRootElement);
    }
  }

  /**
   * Form and show the right panel of the Features tree.
   * @param {CollectedPart} theCollectedPart
   */
  initFeaturesTree = (theCollectedPart) => {
    /* Clean up the previous Features tree: */
    const aPrevTreeElement = document.querySelector('.tree-view-panel details');
    if (aPrevTreeElement) {
      aPrevTreeElement.remove();
    }
    /* Clean up the unfolded features tab: */
    const anUnfoldedFeaturesTab = document.querySelector('.tree-view-panel .unfolded-features');
    if (anUnfoldedFeaturesTab) {
      anUnfoldedFeaturesTab.remove();
    }
    const anErrorMessageElement = document.querySelector('.tree-view-panel .error-message');
    if (anErrorMessageElement) {
      anErrorMessageElement.remove();
    }

    const anExampleContainer = document.getElementById('example-container');
    const aTreeViewPanel = document.querySelector('.tree-view-panel');
    anExampleContainer.appendChild(aTreeViewPanel);

    /* If the process data contains error message: */
    const anErrorMessage = theCollectedPart.featuresInfo.error || (
      this.isModelUnfolded
        ? theCollectedPart.featuresInfo.featureRecognitionUnfolded.message
        : theCollectedPart.featuresInfo.featureRecognition.message
      );
    if (anErrorMessage) {
      const anErrorMessageElement = document.createElement('div');
      anErrorMessageElement.classList.add('error-message');
      anErrorMessageElement.innerHTML = anErrorMessage;
      aTreeViewPanel.appendChild(anErrorMessageElement);
    }
    /* Features tab for unfolded model contain some basic information: */
    else if (this.isModelUnfolded) {
      const anUnfoldedFeaturesElement = document.createElement('section');
      anUnfoldedFeaturesElement.classList.add('unfolded-features');

      theCollectedPart.featuresInfo.featureRecognitionUnfolded.parameters.forEach((theParameter) => {
        const anUnfoldedFeatureElement = document.createElement('article');

        const aParameterName = document.createElement('div');
        aParameterName.innerHTML = theParameter.name;

        const aParameterValue = document.createElement('div');
        aParameterValue.innerHTML = isNaN(theParameter.value) ? theParameter.value : Number(theParameter.value).toFixed(2);

        const aParameterUnits = document.createElement('div');
        aParameterUnits.innerHTML = theParameter.units;

        anUnfoldedFeatureElement.appendChild(aParameterName);
        anUnfoldedFeatureElement.appendChild(aParameterValue);
        anUnfoldedFeatureElement.appendChild(aParameterUnits);

        anUnfoldedFeaturesElement.appendChild(anUnfoldedFeatureElement);
      });

      aTreeViewPanel.appendChild(anUnfoldedFeaturesElement);
    }
    /* Form the Features tree as a tree of HTML-details elements: */
    else {
      const aRootElement = document.createElement('details');
      aRootElement.setAttribute('open', true);
      const aRootElementLabel = document.createElement('summary');
      aRootElementLabel.innerHTML = theCollectedPart.label;
      aRootElement.appendChild(aRootElementLabel);

      theCollectedPart.featuresInfo.featureRecognition.featureGroups.forEach((theFeatureGroup) => {
        const aFeatureGroupElement = document.createElement('details');
        aFeatureGroupElement.setAttribute('open', true)
        const aFeatureGroupElementLabel = document.createElement('summary');
        aFeatureGroupElementLabel.innerHTML = theFeatureGroup.name;
        aFeatureGroupElement.appendChild(aFeatureGroupElementLabel);

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
            aFeatureElement.addEventListener('click', this.onFeaturesTreeElementClick);
            aFeatureGroupElement.appendChild(aFeatureElement);
          });
        }
        else if (theFeatureGroup.subGroups) {
          theFeatureGroup.subGroups.forEach((theSubGroup) => {
            const aSubGroupElement = document.createElement('details');
            const aSubGroupElementLabel = document.createElement('summary');
            const aParametersValues = theSubGroup.parameters.map((theParameter) => isNaN(theParameter.value) ? theParameter.value : Number(theParameter.value).toFixed(2));
            aSubGroupElementLabel.innerHTML = theFeatureGroup.name.replace('(s)', '') + ' (' + aParametersValues.join(', ') + ')';
            aSubGroupElement.appendChild(aSubGroupElementLabel);

            theSubGroup.features.forEach((theFeature) => {
              /* Each feature can be associated with one or more shapes: */
              const aFeatureElement = document.createElement('span');
              if (Number(theFeature.shapeIDCount) > 0) {
                aFeatureElement.setAttribute('data-shape-id', theFeature.shapeIDs.map((theShapeID) => theShapeID.id).join(' '));
              }
              const aParameters = theSubGroup.parameters.map((theParameter) => `${theParameter.name} - ${isNaN(theParameter.value) ? theParameter.value : Number(theParameter.value).toFixed(2)} ${theParameter.units}`).join(', ');
              aFeatureElement.innerHTML = aParameters;
              /* Calling a selection on the scene for the click event on an element of the features tree: */
              aFeatureElement.addEventListener('click', this.onFeaturesTreeElementClick);
              aSubGroupElement.appendChild(aFeatureElement);
            });

            aFeatureGroupElement.appendChild(aSubGroupElement);
          });
        }

        aRootElement.appendChild(aFeatureGroupElement);
      });

      aTreeViewPanel.appendChild(aRootElement);
    }
  }
}

/* Get model name from URL route: */
const aModelName = decodeURI(window.location.pathname.split('/').at(-1));

/* Get MTK data of the converted model as JSON object: */
const aProcessData = await fetchProcessData(aModelName);

/* Initialize the example functionality class: */
const aMTKExample = new MTKExample(aModelName, aProcessData);
aMTKExample.loadAndDisplayModel();

/* Add a listener for changing the model type selector: */
const onChangeModelTypeSelector = () => aMTKExample.loadAndDisplayModel();
document.getElementById('inputRadioOriginalType').addEventListener('click', onChangeModelTypeSelector);
document.getElementById('inputRadioUnfoldedType').addEventListener('click', onChangeModelTypeSelector);
