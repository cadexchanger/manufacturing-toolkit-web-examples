import cadex from '@cadexchanger/web-toolkit';

class CustomSGEVisitor extends cadex.ModelData_SceneGraphElementVisitor {
  /**
   * @param {cadex.ModelData_RepresentationMask} theRepMask Defines a mask to filter part representations. Filter any representation by default.
   */
  constructor(theRepMask = cadex.ModelData_RepresentationMask.ModelData_RM_Any) {
    super();
    this.repMask = theRepMask;
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
    this.collectedParts.length = 0;
  }

  /**
   * Fill the CustomSGEVisitor collected parts collection by the data of the each part of model.
   * @override
   * @param {!cadex.ModelData_Part} thePart
   */
  visitPart(thePart) {
    const aPartID = thePart.uuid ? thePart.uuid.toString() : '';
    /* Only unique parts (not all instances) should be present in the part selection drop-down list: */
    if (!this.collectedParts.find((theCollectedPart) => theCollectedPart.sge === thePart)) {
      this.collectedParts.push({
        id: aPartID,
        label: thePart.name || 'Unnamed part',
        sge: thePart,
        representation: thePart.representation(this.repMask),
      });
    }
  }
}

export class Viewer {
  /**
   * @param {HTMLElement} theElement Element for attaching a viewport.
   */
  constructor(theElement) {
    /* The model object is from a file in native CAD Exchanger format (see the docs for a detailed description): */
    this._model = new cadex.ModelData_Model();

    /* The scene for visualization: */
    this._scene = new cadex.ModelPrs_Scene();

    /* The viewport for visualization. Initializing with default config and element attach to. */
    this._viewport = new cadex.ModelPrs_ViewPort({}, theElement);
    /* Attach viewport to scene to render content of */
    this._viewport.attachToScene(this._scene);

    /** @type {CustomSGEVisitor} */
    this._customSGEVisitor = new CustomSGEVisitor();

    this._hasBRepRep = false;

    /** @type {cadex.ModelPrs_SceneNodeFactory} */
    this._sceneNodeFactory = new cadex.ModelPrs_SceneNodeFactory();
    /** @type {cadex.ModelPrs_SceneNode} */
    this._rootSceneNode = new cadex.ModelPrs_SceneNode();

    this._collectedParts = this._customSGEVisitor.collectedParts;
  }

  /**
   * Load the model and accept SGE visitor.
   * @param {cadex.ModelData_CDXFBBufferProvider} theDataLoader
   * @param {string} theModelName
   */
  async loadModel(theDataLoader, theModelName) {
    try {
      /* Load model by URL: */
      const aLoadResult = await this._model.loadFile(theModelName, theDataLoader, false /*append roots*/);
      console.log(`${theModelName} is loaded\n`, aLoadResult);

      this._hasBRepRep = aLoadResult.hasBRepRep;

      /* If the loaded model contains a B-Rep representation for at least one part
        then define a BRep mask to filter part representations: */
      const aRepMask = this._hasBRepRep
        ? cadex.ModelData_RepresentationMask.ModelData_RM_BRep
        : cadex.ModelData_RepresentationMask.ModelData_RM_Poly;

      /* Change representation mask for CustomSGEVisitor: */
      this._customSGEVisitor.clear();
      this._customSGEVisitor.updateRepMask(aRepMask);

      /* Fill the CustomSGEVisitor collected parts collection by the data of the each part of model:  */
      await this._model.accept(this._customSGEVisitor);
    }
    catch (theErr) {
      console.error('Unable to load model: ', theErr);
      alert(`Unable to load model "${theModelName}" [${/** @type {Error} */(theErr).message}]`);
    }
  }

  /**
   * Remove the root part from the scene.
   */
  async removeRootPart() {
    try {
      this._scene.removeRoot(this._rootSceneNode);
      await this._scene.update();

      /* Finally move camera to position when the whole model is in sight: */
      this._viewport.fitAll();
    }
    catch (theErr) {
      console.error('Unable to remove part: ', theErr);
      alert(`Unable to remove part [${/** @type {Error} */(theErr).message}]`);
    }
  }

  /**
   * Add and display the part on the scene.
   * @param {cadex.ModelData_Part} theSGE
   * @param {cadex.ModelPrs_SelectionMode} theSelectionMode cadex.ModelPrs_SelectionMode.Face by default
   * @param {cadex.ModelPrs_DisplayMode} theDisplayMode cadex.ModelPrs_DisplayMode.Shaded by default
   */
  async addRootPart(theSGE, theSelectionMode = cadex.ModelPrs_SelectionMode.Face, theDisplayMode = cadex.ModelPrs_DisplayMode.Shaded) {
    try {
      /* Create visualization graph for model: */
      this._rootSceneNode = this._sceneNodeFactory.createNodeFromSceneGraphElement(theSGE);

      if (!this._rootSceneNode) {
        throw new Error('Unable to create scene node from SGE.');
      }

      /* Set display mode for visualization: */
      this._rootSceneNode.displayMode = theDisplayMode;
      /* Set selection for visualization: */
      this._rootSceneNode.selectionMode = theSelectionMode;

      /* Add visualization graph for model to scene: */
      this._scene.addRoot(this._rootSceneNode);

      /* Update the scene to see visualization changes: */
      await this._scene.update();

      /* Finally move camera to position when the whole model is in sight: */
      this._viewport.fitAll();
    }
    catch (theErr) {
      console.error('Unable to add and display part: ', theErr);
      alert(`Unable to add and display part [${/** @type {Error} */(theErr).message}]`);
    }
  }

  /**
   * Add the body to the part and display on the scene.
   * @param {cadex.ModelData_Body} theBody
   * @param {{r: number, g: number, b: number}} [theRGBColor]
   * @return {Promise<cadex.ModelPrs_SceneNode | undefined>} Created body scene node.
   */
  async addBodyToRootPart(theBody, theRGBColor) {
    try {
      const aBodySceneNode = this._sceneNodeFactory.createNodeFromBody(theBody);
      if (theRGBColor) {
        aBodySceneNode.appearance = new cadex.ModelData_Appearance(
          new cadex.ModelData_ColorObject(theRGBColor.r, theRGBColor.g, theRGBColor.b)
        );
      }

      this._rootSceneNode.addChildNode(aBodySceneNode);

      /* Update the scene to see visualization changes: */
      await this._scene.update();

      /* Finally move camera to position when the whole model is in sight: */
      this._viewport.fitAll();

      return aBodySceneNode;
    }
    catch (theErr) {
      console.error('Unable to add and display body: ', theErr);
      alert(`Unable to add and display body [${/** @type {Error} */(theErr).message}]`);
    }
  }

  /**
   * Form a body from shapes IDs.
   * @param {Array<cadex.ModelData_Shape>} theShapes
   * @return {Promise<cadex.ModelData_Body | undefined>}
   */
  async formBody(theShapes) {
    try {
      const anInitBodyShape = theShapes.pop();
      if (anInitBodyShape) {
        const aBody = cadex.ModelData_Body.create(anInitBodyShape);
        if (aBody) {
          theShapes.forEach((theShape) => aBody.append(theShape));
          return aBody;
        }
      }
    }
    catch (theErr) {
      console.error('Unable to form body: ', theErr);
      alert(`Unable to form body [${/** @type {Error} */(theErr).message}]`);
    }
  }
}
