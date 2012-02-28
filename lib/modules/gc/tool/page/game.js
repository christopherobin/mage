//**********************************************************************************************************//
//  File: game.js
//  Date: 2011/07/07
//  Description: Game definition that your game should inherit.
//  Will console.log if you don't have the function defined in your game module.
//
//  Example: var YourGame = Object.create(Game);
//
//*********************************************************************************************************//

function Game() {}

//********************************************
//  Behavior for clicking events and keyboard handler
//********************************************

// keydown and keyup
Game.prototype.keydownHandler      = function() { console.log('function keydownHandler() has not been defined in the game module.'); };
Game.prototype.keyupHander         = function() { console.log('function keyupHandler() has not been defined in the game module.'); };
// Clicking on a node
Game.prototype.nodeClick           = function() { console.log('function nodeClick() has not been defined in the game module.'); };
// Clicking add/edit/delete buttons
Game.prototype.addNode             = function() { console.log('function addNode() has not been defined in the game module.'); };
Game.prototype.editNode            = function() { console.log('function editNode() has not been defined in the game module.'); };
Game.prototype.deleteNode          = function() { console.log('function deleteNode() has not been defined in the game module.'); };
// Adding endpoints
Game.prototype.addInput            = function() { console.log('function addInput() has not been defined in the game module.'); };
Game.prototype.addOutput           = function() { console.log('function addOutput() has not been defined in the game module.'); };
// Behavoir when clicking a link to a node
Game.prototype.gotoError           = function() { console.log('function gotoError() has not been defined in the game module.'); };

//********************************************
//  Functions to grab types of nodes
//********************************************

Game.prototype.getChildTypes       = function() { console.log('function getChildTypes() has not been defined in the game module.'); };
Game.prototype.getSiblingTypes     = function() { console.log('function getSiblingTypes() has not been defined in the game module.'); };
Game.prototype.getParentTypes      = function() { console.log('function getSiblingTypes() has not been defined in the game module.'); };
Game.prototype.getAvailableTypes   = function() { console.log('function getSiblingTypes() has not been defined in the game module.'); };

//********************************************
//  Functions for getting lists of nodes
//********************************************

Game.prototype.getChildren         = function() { console.log('function getPrevSiblings() has not been defined in the game module.'); };
Game.prototype.getDescendents      = function() { console.log('function getPrevSiblings() has not been defined in the game module.'); };
Game.prototype.getOuts             = function() { console.log('function getPrevSiblings() has not been defined in the game module.'); };
Game.prototype.getAncestors        = function() { console.log('function getPrevSiblings() has not been defined in the game module.'); };
Game.prototype.getFirstChilds      = function() { console.log('function getPrevSiblings() has not been defined in the game module.'); };
Game.prototype.getSiblings         = function() { console.log('function getSiblings() has not been defined in the game module.'); };
// Get previous siblings of a node in the same branch
Game.prototype.getPrevSiblings     = function() { console.log('function getPrevSiblings() has not been defined in the game module.'); };
// Get next siblings of a node in the same branch
Game.prototype.getNextSiblings     = function() { console.log('function getNextSiblings() has not been defined in the game module.'); };
// Get the nodes traversed from a node to the end
Game.prototype.getTraverseNodes    = function() { console.log('function getTraverseNodes() has not been defined in the game module.'); };

//********************************************
//  Functions for error checking
//********************************************

// Different types of error checks
Game.prototype.checkStructure      = function() { console.log('function checkStructure() has not been defined in the game module.'); };
Game.prototype.checkData           = function() { console.log('function checkData() has not been defined in the game module.'); };
Game.prototype.traverse            = function() { console.log('function traverse() has not been defined in the game module.'); };
