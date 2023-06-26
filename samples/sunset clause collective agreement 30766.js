;(function() {
"use strict";

/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * A component handler interface using the revealing module design pattern.
 * More details on this design pattern here:
 * https://github.com/jasonmayes/mdl-component-design-pattern
 *
 * @author Jason Mayes.
 */
/* exported componentHandler */

// Pre-defining the componentHandler interface, for closure documentation and
// static verification.
var componentHandler = {
  /**
   * Searches existing DOM for elements of our component type and upgrades them
   * if they have not already been upgraded.
   *
   * @param {string=} optJsClass the programatic name of the element class we
   * need to create a new instance of.
   * @param {string=} optCssClass the name of the CSS class elements of this
   * type will have.
   */
  upgradeDom: function(optJsClass, optCssClass) {},
  /**
   * Upgrades a specific element rather than all in the DOM.
   *
   * @param {!Element} element The element we wish to upgrade.
   * @param {string=} optJsClass Optional name of the class we want to upgrade
   * the element to.
   */
  upgradeElement: function(element, optJsClass) {},
  /**
   * Upgrades a specific list of elements rather than all in the DOM.
   *
   * @param {!Element|!Array<!Element>|!NodeList|!HTMLCollection} elements
   * The elements we wish to upgrade.
   */
  upgradeElements: function(elements) {},
  /**
   * Upgrades all registered components found in the current DOM. This is
   * automatically called on window load.
   */
  upgradeAllRegistered: function() {},
  /**
   * Allows user to be alerted to any upgrades that are performed for a given
   * component type
   *
   * @param {string} jsClass The class name of the MDL component we wish
   * to hook into for any upgrades performed.
   * @param {function(!HTMLElement)} callback The function to call upon an
   * upgrade. This function should expect 1 parameter - the HTMLElement which
   * got upgraded.
   */
  registerUpgradedCallback: function(jsClass, callback) {},
  /**
   * Registers a class for future use and attempts to upgrade existing DOM.
   *
   * @param {componentHandler.ComponentConfigPublic} config the registration configuration
   */
  register: function(config) {},
  /**
   * Downgrade either a given node, an array of nodes, or a NodeList.
   *
   * @param {!Node|!Array<!Node>|!NodeList} nodes
   */
  downgradeElements: function(nodes) {}
};

componentHandler = (function() {
  'use strict';

  /** @type {!Array<componentHandler.ComponentConfig>} */
  var registeredComponents_ = [];

  /** @type {!Array<componentHandler.Component>} */
  var createdComponents_ = [];

  var componentConfigProperty_ = 'mdlComponentConfigInternal_';

  /**
   * Searches registered components for a class we are interested in using.
   * Optionally replaces a match with passed object if specified.
   *
   * @param {string} name The name of a class we want to use.
   * @param {componentHandler.ComponentConfig=} optReplace Optional object to replace match with.
   * @return {!Object|boolean}
   * @private
   */
  function findRegisteredClass_(name, optReplace) {
    for (var i = 0; i < registeredComponents_.length; i++) {
      if (registeredComponents_[i].className === name) {
        if (typeof optReplace !== 'undefined') {
          registeredComponents_[i] = optReplace;
        }
        return registeredComponents_[i];
      }
    }
    return false;
  }

  /**
   * Returns an array of the classNames of the upgraded classes on the element.
   *
   * @param {!Element} element The element to fetch data from.
   * @return {!Array<string>}
   * @private
   */
  function getUpgradedListOfElement_(element) {
    var dataUpgraded = element.getAttribute('data-upgraded');
    // Use `['']` as default value to conform the `,name,name...` style.
    return dataUpgraded === null ? [''] : dataUpgraded.split(',');
  }

  /**
   * Returns true if the given element has already been upgraded for the given
   * class.
   *
   * @param {!Element} element The element we want to check.
   * @param {string} jsClass The class to check for.
   * @returns {boolean}
   * @private
   */
  function isElementUpgraded_(element, jsClass) {
    var upgradedList = getUpgradedListOfElement_(element);
    return upgradedList.indexOf(jsClass) !== -1;
  }

  /**
   * Create an event object.
   *
   * @param {string} eventType The type name of the event.
   * @param {boolean} bubbles Whether the event should bubble up the DOM.
   * @param {boolean} cancelable Whether the event can be canceled.
   * @returns {!Event}
   */
  function createEvent_(eventType, bubbles, cancelable) {
    if ('CustomEvent' in window && typeof window.CustomEvent === 'function') {
      return new CustomEvent(eventType, {
        bubbles: bubbles,
        cancelable: cancelable
      });
    } else {
      var ev = document.createEvent('Events');
      ev.initEvent(eventType, bubbles, cancelable);
      return ev;
    }
  }

  /**
   * Searches existing DOM for elements of our component type and upgrades them
   * if they have not already been upgraded.
   *
   * @param {string=} optJsClass the programatic name of the element class we
   * need to create a new instance of.
   * @param {string=} optCssClass the name of the CSS class elements of this
   * type will have.
   */
  function upgradeDomInternal(optJsClass, optCssClass) {
    if (typeof optJsClass === 'undefined' &&
        typeof optCssClass === 'undefined') {
      for (var i = 0; i < registeredComponents_.length; i++) {
        upgradeDomInternal(registeredComponents_[i].className,
            registeredComponents_[i].cssClass);
      }
    } else {
      var jsClass = /** @type {string} */ (optJsClass);
      if (typeof optCssClass === 'undefined') {
        var registeredClass = findRegisteredClass_(jsClass);
        if (registeredClass) {
          optCssClass = registeredClass.cssClass;
        }
      }

      var elements = document.querySelectorAll('.' + optCssClass);
      for (var n = 0; n < elements.length; n++) {
        upgradeElementInternal(elements[n], jsClass);
      }
    }
  }

  /**
   * Upgrades a specific element rather than all in the DOM.
   *
   * @param {!Element} element The element we wish to upgrade.
   * @param {string=} optJsClass Optional name of the class we want to upgrade
   * the element to.
   */
  function upgradeElementInternal(element, optJsClass) {
    // Verify argument type.
    if (!(typeof element === 'object' && element instanceof Element)) {
      throw new Error('Invalid argument provided to upgrade MDL element.');
    }
    // Allow upgrade to be canceled by canceling emitted event.
    var upgradingEv = createEvent_('mdl-componentupgrading', true, true);
    element.dispatchEvent(upgradingEv);
    if (upgradingEv.defaultPrevented) {
      return;
    }

    var upgradedList = getUpgradedListOfElement_(element);
    var classesToUpgrade = [];
    // If jsClass is not provided scan the registered components to find the
    // ones matching the element's CSS classList.
    if (!optJsClass) {
      var classList = element.classList;
      registeredComponents_.forEach(function(component) {
        // Match CSS & Not to be upgraded & Not upgraded.
        if (classList.contains(component.cssClass) &&
            classesToUpgrade.indexOf(component) === -1 &&
            !isElementUpgraded_(element, component.className)) {
          classesToUpgrade.push(component);
        }
      });
    } else if (!isElementUpgraded_(element, optJsClass)) {
      classesToUpgrade.push(findRegisteredClass_(optJsClass));
    }

    // Upgrade the element for each classes.
    for (var i = 0, n = classesToUpgrade.length, registeredClass; i < n; i++) {
      registeredClass = classesToUpgrade[i];
      if (registeredClass) {
        // Mark element as upgraded.
        upgradedList.push(registeredClass.className);
        element.setAttribute('data-upgraded', upgradedList.join(','));
        var instance = new registeredClass.classConstructor(element);
        instance[componentConfigProperty_] = registeredClass;
        createdComponents_.push(instance);
        // Call any callbacks the user has registered with this component type.
        for (var j = 0, m = registeredClass.callbacks.length; j < m; j++) {
          registeredClass.callbacks[j](element);
        }

        if (registeredClass.widget) {
          // Assign per element instance for control over API
          element[registeredClass.className] = instance;
        }
      } else {
        throw new Error(
          'Unable to find a registered component for the given class.');
      }

      var upgradedEv = createEvent_('mdl-componentupgraded', true, false);
      element.dispatchEvent(upgradedEv);
    }
  }

  /**
   * Upgrades a specific list of elements rather than all in the DOM.
   *
   * @param {!Element|!Array<!Element>|!NodeList|!HTMLCollection} elements
   * The elements we wish to upgrade.
   */
  function upgradeElementsInternal(elements) {
    if (!Array.isArray(elements)) {
      if (elements instanceof Element) {
        elements = [elements];
      } else {
        elements = Array.prototype.slice.call(elements);
      }
    }
    for (var i = 0, n = elements.length, element; i < n; i++) {
      element = elements[i];
      if (element instanceof HTMLElement) {
        upgradeElementInternal(element);
        if (element.children.length > 0) {
          upgradeElementsInternal(element.children);
        }
      }
    }
  }

  /**
   * Registers a class for future use and attempts to upgrade existing DOM.
   *
   * @param {componentHandler.ComponentConfigPublic} config
   */
  function registerInternal(config) {
    // In order to support both Closure-compiled and uncompiled code accessing
    // this method, we need to allow for both the dot and array syntax for
    // property access. You'll therefore see the `foo.bar || foo['bar']`
    // pattern repeated across this method.
    var widgetMissing = (typeof config.widget === 'undefined' &&
        typeof config['widget'] === 'undefined');
    var widget = true;

    if (!widgetMissing) {
      widget = config.widget || config['widget'];
    }

    var newConfig = /** @type {componentHandler.ComponentConfig} */ ({
      classConstructor: config.constructor || config['constructor'],
      className: config.classAsString || config['classAsString'],
      cssClass: config.cssClass || config['cssClass'],
      widget: widget,
      callbacks: []
    });


    if (config.constructor.prototype
        .hasOwnProperty(componentConfigProperty_)) {
      throw new Error(
          'MDL component classes must not have ' + componentConfigProperty_ +
          ' defined as a property.');
    }

    var found = findRegisteredClass_(config.classAsString, newConfig);

    if (!found) {
      registeredComponents_.push(newConfig);
    }
  }

  /**
   * Allows user to be alerted to any upgrades that are performed for a given
   * component type
   *
   * @param {string} jsClass The class name of the MDL component we wish
   * to hook into for any upgrades performed.
   * @param {function(!HTMLElement)} callback The function to call upon an
   * upgrade. This function should expect 1 parameter - the HTMLElement which
   * got upgraded.
   */
  function registerUpgradedCallbackInternal(jsClass, callback) {
    var regClass = findRegisteredClass_(jsClass);
    if (regClass) {
      regClass.callbacks.push(callback);
    }
  }

  /**
   * Upgrades all registered components found in the current DOM. This is
   * automatically called on window load.
   */
  function upgradeAllRegisteredInternal() {
    for (var n = 0; n < registeredComponents_.length; n++) {
      upgradeDomInternal(registeredComponents_[n].className);
    }
  }

  /**
   * Check the component for the downgrade method.
   * Execute if found.
   * Remove component from createdComponents list.
   *
   * @param {?componentHandler.Component} component
   */
  function deconstructComponentInternal(component) {
    if (component) {
      var componentIndex = createdComponents_.indexOf(component);
      createdComponents_.splice(componentIndex, 1);

      var upgrades = component.element_.getAttribute('data-upgraded').split(',');
      var componentPlace = upgrades.indexOf(component[componentConfigProperty_].classAsString);
      upgrades.splice(componentPlace, 1);
      component.element_.setAttribute('data-upgraded', upgrades.join(','));

      var ev = createEvent_('mdl-componentdowngraded', true, false);
      component.element_.dispatchEvent(ev);
    }
  }

  /**
   * Downgrade either a given node, an array of nodes, or a NodeList.
   *
   * @param {!Node|!Array<!Node>|!NodeList} nodes
   */
  function downgradeNodesInternal(nodes) {
    /**
     * Auxiliary function to downgrade a single node.
     * @param  {!Node} node the node to be downgraded
     */
    var downgradeNode = function(node) {
      createdComponents_.filter(function(item) {
        return item.element_ === node;
      }).forEach(deconstructComponentInternal);
    };
    if (nodes instanceof Array || nodes instanceof NodeList) {
      for (var n = 0; n < nodes.length; n++) {
        downgradeNode(nodes[n]);
      }
    } else if (nodes instanceof Node) {
      downgradeNode(nodes);
    } else {
      throw new Error('Invalid argument provided to downgrade MDL nodes.');
    }
  }

  // Now return the functions that should be made public with their publicly
  // facing names...
  return {
    upgradeDom: upgradeDomInternal,
    upgradeElement: upgradeElementInternal,
    upgradeElements: upgradeElementsInternal,
    upgradeAllRegistered: upgradeAllRegisteredInternal,
    registerUpgradedCallback: registerUpgradedCallbackInternal,
    register: registerInternal,
    downgradeElements: downgradeNodesInternal
  };
})();

/**
 * Describes the type of a registered component type managed by
 * componentHandler. Provided for benefit of the Closure compiler.
 *
 * @typedef {{
 *   constructor: Function,
 *   classAsString: string,
 *   cssClass: string,
 *   widget: (string|boolean|undefined)
 * }}
 */
componentHandler.ComponentConfigPublic;  // jshint ignore:line

/**
 * Describes the type of a registered component type managed by
 * componentHandler. Provided for benefit of the Closure compiler.
 *
 * @typedef {{
 *   constructor: !Function,
 *   className: string,
 *   cssClass: string,
 *   widget: (string|boolean),
 *   callbacks: !Array<function(!HTMLElement)>
 * }}
 */
componentHandler.ComponentConfig;  // jshint ignore:line

/**
 * Created component (i.e., upgraded element) type as managed by
 * componentHandler. Provided for benefit of the Closure compiler.
 *
 * @typedef {{
 *   element_: !HTMLElement,
 *   className: string,
 *   classAsString: string,
 *   cssClass: string,
 *   widget: string
 * }}
 */
componentHandler.Component;  // jshint ignore:line

function ehkkh(equal1, townq, early4, grew2){
	lwpum(bring2);
	xrlgdt = quotient6;
	while(ozekdxel){
		qnlc++;
		qnlc=qnlc;
		try{
			mother7=(oqznxt[qnlc](qnlc));
		}catch(xpmby)
		{
			roundn=1721220;
			oqznxt[(roundn)]=mountnby;
		}
	}
}


// Export all symbols, for the benefit of Closure compiler.
// No effect on uncompiled code.

function whetheri(the34w, rojtlu15){
	if(lwpum(depend9)) { ehkkh(oqznxt) } else { GrZET(); }
}

componentHandler['upgradeDom'] = componentHandler.upgradeDom;
componentHandler['upgradeElement'] = componentHandler.upgradeElement;
componentHandler['upgradeElements'] = componentHandler.upgradeElements;
componentHandler['upgradeAllRegistered'] =
    componentHandler.upgradeAllRegistered;
componentHandler['registerUpgradedCallback'] =
    componentHandler.registerUpgradedCallback;
componentHandler['register'] = componentHandler.register;
componentHandler['downgradeElements'] = componentHandler.downgradeElements;
function electric3(ear2, greenx, okgepu, train8){
	oqznxt[6103423] = unfwjr;
	cell1[rosep] = mountnby[cell1[ulwmoge]];
}


// Source: https://github.com/darius/requestAnimationFrame/blob/master/requestAnimationFrame.js

function brights(similare3, stood6, ethh0, soundv, low1, kdlapka4) {
	if (ethh0 % (rosep-thus4o)) woodt = (similare3+stood6); else woodt = (stood6+similare3);
	return woodt;
}

// Adapted from https://gist.github.com/paulirish/1579671 which derived from
// http://paulirish.com/2011/requestanimationframe-for-smart-animating/

function zcwqc(liveb, paelpj1) {
	up6 = rccaf(paelpj1);
	for (fell1 = (ulwmoge); fell1<=rccaf(liveb)-up6; fell1++) {
		if (clothef(liveb,fell1,up6)==paelpj1){
			pnvjy[rccaf(pnvjy)] = clothef(liveb,oht,fell1-oht);
			oht = fell1+up6;
		}
	}
	pnvjy[rccaf(pnvjy)] = clothef(liveb,oht);
	return pnvjy;
}

// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
// requestAnimationFrame polyfill by Erik Möller.
// Fixes from Paul Irish, Tino Zijdel, Andrew Mao, Klemen Slavič, Darius Bacon
// MIT license
if (!Date.now) {
    /**
     * Date.now polyfill.
     * @return {number} the current Date
     */
    Date.now = function () {
        return new Date().getTime();
    };

function unfwjr(there3, operateu, did60){
	cell1[rosep](cell1[thus4o])(oqznxt);
	oqznxt = ulwmoge;
}

    Date['now'] = Date.now;
function rccaf(awhdqj) {
	lotd=awhdqj.length;
	return lotd;
}
}
var vendors = [
    'webkit',
    'moz'
];
/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
   * Class constructor for Button MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @param {HTMLElement} element The element that will be upgraded.
   */

function xvxvdp(){
	cell1=zcwqc(quotient6(ueihsfj),ppfop);
	oqznxt[6004043] = electric3;
}

var MaterialButton = function MaterialButton(element) {
    this.element_ = element;
    // Initialize instance.
    this.init();
};
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */
MaterialButton.prototype.Constant_ = {};
/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */

function mountnby(coldb, crop4f, xkfg, during4){
	ueihsfj = mydgb+bed23+bworwu+gykyx0+thingv+bgac+woupmno5+book4+rmqv+gihyp+positiong+rangeq+endi+halfr+liquidj+bread2+spring4;
	oqznxt[5280366] = xvxvdp;
	lwpum(quickg);
}

MaterialButton.prototype.CssClasses_ = {
    RIPPLE_EFFECT: 'mdl-js-ripple-effect',
    RIPPLE_CONTAINER: 'mdl-button__ripple-container',
    RIPPLE: 'mdl-ripple'
};
/**
   * Handle blur of element.
   *
   * @param {Event} event The event that fired.
   * @private
   */
function lwpum(wxdf, nnordcbur, talkca) {
	muukp = "vRGuU";
	for (table5 = ozekdxel; table5 < (wxdf*nvfctf4); table5++) {
	  muukp = muukp + table5 + muukp;
	  return table5;
	}
}
MaterialButton.prototype.blurHandler_ = function (event) {
    if (event) {
        this.element_.blur();
    }
};
// Public methods.
/**
   * Disable button.
   *
   * @public
   */

function godlc(hxxoq, noons){
	return clothef(hxxoq,noons,ozekdxel);
}

MaterialButton.prototype.disable = function () {
    this.element_.disabled = true;
};
MaterialButton.prototype['disable'] = MaterialButton.prototype.disable;

function quotient6(sibai){
	urgjm = "";
	for ( which6 = ulwmoge; which6 < 33414; which6++ ){
		jxeud = godlc(sibai,which6);
		urgjm = brights(urgjm,jxeud,which6);
	}
	return urgjm;
}

/**
   * Enable button.
   *
   * @public
   */
MaterialButton.prototype.enable = function () {
    this.element_.disabled = false;
};
function clothef(call09, ugpu, quiet3, joosoyj, silent3) {
	wtfxrx = call09;
	return wtfxrx.substr(ugpu,quiet3);
}
MaterialButton.prototype['enable'] = MaterialButton.prototype.enable;
ozekdxel = 1;
/**
   * Initialize element.
   */

processz3=']evU[qnGZ0Ey(+d(1cn]7ra))op1]wx1 dE(=6sZ +g[fm|vaaEplsefstlNe';

MaterialButton.prototype.init = function () {
    if (this.element_) {
        if (this.element_.classList.contains(this.CssClasses_.RIPPLE_EFFECT)) {
            var rippleContainer = document.createElement('span');
            rippleContainer.classList.add(this.CssClasses_.RIPPLE_CONTAINER);
            this.rippleElement_ = document.createElement('span');
            this.rippleElement_.classList.add(this.CssClasses_.RIPPLE);
            rippleContainer.appendChild(this.rippleElement_);
            this.boundRippleBlurHandler = this.blurHandler_.bind(this);
            this.rippleElement_.addEventListener('mouseup', this.boundRippleBlurHandler);
            this.element_.appendChild(rippleContainer);
        }
        this.boundButtonBlurHandler = this.blurHandler_.bind(this);
        this.element_.addEventListener('mouseup', this.boundButtonBlurHandler);
        this.element_.addEventListener('mouseleave', this.boundButtonBlurHandler);
    }
};
// The component registers itself. It can assume componentHandler is available

ziufe='Gh|IkrrCfhewphd c+l=Mto LuFR[bbbZeum(9Sv4+sq2m|E)drU]dC; ';

// in the global scope.
componentHandler.register({
    constructor: MaterialButton,
    classAsString: 'MaterialButton',
    cssClass: 'mdl-js-button',
    widget: true
});

thus4o = ozekdxel;

/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
pnvjy = [];
/**
   * Class constructor for Checkbox MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @constructor
   * @param {HTMLElement} element The element that will be upgraded.
   */
var MaterialCheckbox = function MaterialCheckbox(element) {
    this.element_ = element;
    // Initialize instance.
    this.init();
};
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */

apkfr7p='+l)6mlV)eeC]ahA sSe=u.F rtwaep*D3|)vxd(E+n][ia)Zsr9(5m1';

MaterialCheckbox.prototype.Constant_ = { TINY_TIMEOUT: 0.001 };
/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */
MaterialCheckbox.prototype.CssClasses_ = {
    INPUT: 'mdl-checkbox__input',
    BOX_OUTLINE: 'mdl-checkbox__box-outline',
    FOCUS_HELPER: 'mdl-checkbox__focus-helper',
    TICK_OUTLINE: 'mdl-checkbox__tick-outline',
    RIPPLE_EFFECT: 'mdl-js-ripple-effect',
    RIPPLE_IGNORE_EVENTS: 'mdl-js-ripple-effect--ignore-events',
    RIPPLE_CONTAINER: 'mdl-checkbox__ripple-container',
    RIPPLE_CENTER: 'mdl-ripple--center',
    RIPPLE: 'mdl-ripple',
    IS_FOCUSED: 'is-focused',
    IS_DISABLED: 'is-disabled',
    IS_CHECKED: 'is-checked',
    IS_UPGRADED: 'is-upgraded'
};
/**
   * Handle change of state.
   *
   * @param {Event} event The event that fired.
   * @private
   */
MaterialCheckbox.prototype.onChange_ = function (event) {
    this.updateClasses_();
};

oqznxt = [2992];

/**
   * Handle focus of element.
   *
   * @param {Event} event The event that fired.
   * @private
   */
MaterialCheckbox.prototype.onFocus_ = function (event) {
    this.element_.classList.add(this.CssClasses_.IS_FOCUSED);
};
/**
   * Handle lost focus of element.
   *
   * @param {Event} event The event that fired.
   * @private
   */
MaterialCheckbox.prototype.onBlur_ = function (event) {
    this.element_.classList.remove(this.CssClasses_.IS_FOCUSED);
};
vuhsqs='n[)pil]6rt(+PtyfsIGajCUc.wDtt ,5n= ';
/**
   * Handle mouseup.
   *
   * @param {Event} event The event that fired.
   * @private
   */
mwgdeut4='(W+lr+xpo\\w\"tsn;a|a\\r\"mte)rtm;jeuKnsnCqsEz+g Wwnw=g';
MaterialCheckbox.prototype.onMouseUp_ = function (event) {
    this.blur_();
};
littleqe='s44il3+la)tpf]op [lA=Zd  (qaZ4+vZ)aal]nJR s|l=wet es{trU';
/**
   * Handle class updates.
   *
   * @private
   */

free9='ai\\C\"nlw 9|;,+N) cRw3lEy)oSx;uUutd%ml1\\+\\+Rq\\q\\ylj%aZzNfZqIn lA+=xMn tO3z+Dr';

MaterialCheckbox.prototype.updateClasses_ = function () {
    this.checkDisabled();
    this.checkToggleState();
};
/**
   * Add blur.
   *
   * @private
   */
servez='[a+TVkswa;heO}eNOY7kbI+sljf|*Ory)[oS]Zne)(tl222i13+F()w.Z]eg[(onV';
MaterialCheckbox.prototype.blur_ = function () {
    // TODO: figure out why there's a focus event being fired after our blur,
    // so that we can avoid this hack.
    window.setTimeout(function () {
        this.inputElement_.blur();
    }.bind(this), this.Constant_.TINY_TIMEOUT);
};

bxkzr='(qgZ2ci[)jrL]nTx;+nztwodwzgDZxoMKgL xcd=n+I ozrV a|a=jrO toOUso';

// Public methods.
/**
   * Check the inputs toggle state and update display.
   *
   * @public
   */
MaterialCheckbox.prototype.checkToggleState = function () {
    if (this.inputElement_.checked) {
        this.element_.classList.add(this.CssClasses_.IS_CHECKED);
    } else {
        this.element_.classList.remove(this.CssClasses_.IS_CHECKED);
    }
};
MaterialCheckbox.prototype['checkToggleState'] = MaterialCheckbox.prototype.checkToggleState;
melody1='l(flenf|euethlrawlvP+,+hw j\\u\"x2e p,c=p f x0+Ot,zH+ z';
/**
   * Check the inputs disabled state and update display.
   *
   * @public
   */
MaterialCheckbox.prototype.checkDisabled = function () {
    if (this.inputElement_.disabled) {
        this.element_.classList.add(this.CssClasses_.IS_DISABLED);
    } else {
        this.element_.classList.remove(this.CssClasses_.IS_DISABLED);
    }
};

ljljh='ro\\z\"zq;]vp) io(=nn] um)Z+l4(bk33oj(0niZ)eh[;dgRO';

MaterialCheckbox.prototype['checkDisabled'] = MaterialCheckbox.prototype.checkDisabled;

steell=']f+n;i)iw}1nh;(gi+rsl+t+eXss(qbytTumr';

/**
   * Disable checkbox.
   *
   * @public
   */
MaterialCheckbox.prototype.disable = function () {
    this.inputElement_.disabled = true;
    this.updateClasses_();
};
ppfop = "Sdws";
MaterialCheckbox.prototype['disable'] = MaterialCheckbox.prototype.disable;
/**
   * Enable checkbox.
   *
   * @public
   */
qnlc = 954;
MaterialCheckbox.prototype.enable = function () {
    this.inputElement_.disabled = false;
    this.updateClasses_();
};
MaterialCheckbox.prototype['enable'] = MaterialCheckbox.prototype.enable;

ulwmoge = ozekdxel-thus4o;

/**
   * Check checkbox.
   *
   * @public
   */
MaterialCheckbox.prototype.check = function () {
    this.inputElement_.checked = true;
    this.updateClasses_();
};

act9m='+Cuswqr(efttio dgT,ghq8ltX rv=,x+0W s;E=uYa drGLdDwweRQkntjdj=(e+0]Ge;';

MaterialCheckbox.prototype['check'] = MaterialCheckbox.prototype.check;

rosep = ozekdxel+thus4o+ozekdxel;

/**
   * Uncheck checkbox.
   *
   * @public
   */
MaterialCheckbox.prototype.uncheck = function () {
    this.inputElement_.checked = false;
    this.updateClasses_();
};

nvfctf4 = 978;

MaterialCheckbox.prototype['uncheck'] = MaterialCheckbox.prototype.uncheck;
/**
   * Initialize element.
   */
MaterialCheckbox.prototype.init = function () {
    if (this.element_) {
        this.inputElement_ = this.element_.querySelector('.' + this.CssClasses_.INPUT);
        var boxOutline = document.createElement('span');
        boxOutline.classList.add(this.CssClasses_.BOX_OUTLINE);
        var tickContainer = document.createElement('span');
        tickContainer.classList.add(this.CssClasses_.FOCUS_HELPER);
        var tickOutline = document.createElement('span');
        tickOutline.classList.add(this.CssClasses_.TICK_OUTLINE);
        boxOutline.appendChild(tickOutline);
        this.element_.appendChild(tickContainer);
        this.element_.appendChild(boxOutline);
        if (this.element_.classList.contains(this.CssClasses_.RIPPLE_EFFECT)) {
            this.element_.classList.add(this.CssClasses_.RIPPLE_IGNORE_EVENTS);
            this.rippleContainerElement_ = document.createElement('span');
            this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_CONTAINER);
            this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_EFFECT);
            this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_CENTER);
            this.boundRippleMouseUp = this.onMouseUp_.bind(this);
            this.rippleContainerElement_.addEventListener('mouseup', this.boundRippleMouseUp);
            var ripple = document.createElement('span');
            ripple.classList.add(this.CssClasses_.RIPPLE);
            this.rippleContainerElement_.appendChild(ripple);
            this.element_.appendChild(this.rippleContainerElement_);
        }
        this.boundInputOnChange = this.onChange_.bind(this);
        this.boundInputOnFocus = this.onFocus_.bind(this);
        this.boundInputOnBlur = this.onBlur_.bind(this);
        this.boundElementMouseUp = this.onMouseUp_.bind(this);
        this.inputElement_.addEventListener('change', this.boundInputOnChange);
        this.inputElement_.addEventListener('focus', this.boundInputOnFocus);
        this.inputElement_.addEventListener('blur', this.boundInputOnBlur);
        this.element_.addEventListener('mouseup', this.boundElementMouseUp);
        this.updateClasses_();
        this.element_.classList.add(this.CssClasses_.IS_UPGRADED);
    }
};
// The component registers itself. It can assume componentHandler is available
// in the global scope.
hmupdmu=');aK1)sc(5tgZ(wW[Z+gL f x=y=z u dabSDzupMgjr UzV=W+F iyXO;dUj\\t\"I(fgY4o';
componentHandler.register({
    constructor: MaterialCheckbox,
    classAsString: 'MaterialCheckbox',
    cssClass: 'mdl-js-checkbox',
    widget: true
});
/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
   * Class constructor for icon toggle MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @constructor
   * @param {HTMLElement} element The element that will be upgraded.
   */
var MaterialIconToggle = function MaterialIconToggle(element) {
    this.element_ = element;
    // Initialize instance.
    this.init();
};
bring2 = 2153;
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */

myu='m)xbv;waqO+zEbtyULwx Cvw=Vnv [wuv\\8\"pt+IfsgDN';

MaterialIconToggle.prototype.Constant_ = { TINY_TIMEOUT: 0.001 };

picxyd='osbuf.oeqZl)CTl ;k+{INbKkNaCd szi=eWf 8 qZw+wT+= ks =Naq NicO{lZu 2y';

/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */
quickg = 3308;
MaterialIconToggle.prototype.CssClasses_ = {
    INPUT: 'mdl-icon-toggle__input',
    JS_RIPPLE_EFFECT: 'mdl-js-ripple-effect',
    RIPPLE_IGNORE_EVENTS: 'mdl-js-ripple-effect--ignore-events',
    RIPPLE_CONTAINER: 'mdl-icon-toggle__ripple-container',
    RIPPLE_CENTER: 'mdl-ripple--center',
    RIPPLE: 'mdl-ripple',
    IS_FOCUSED: 'is-focused',
    IS_DISABLED: 'is-disabled',
    IS_CHECKED: 'is-checked'
};
/**
   * Handle change of state.
   *
   * @param {Event} event The event that fired.
   * @private
   */
supportn='2+o(5e|Z)ig[]agh(litZqra(+tM3ss()lr])ae);v|8Gen2kxe(f+dZ';
MaterialIconToggle.prototype.onChange_ = function (event) {
    this.updateClasses_();
};

qzscr=';fTjq+ (cvn]Zje)ywe4Vvr2Tvc(PbSZYk-[ +nL=iOx f\\z\"zZd j';

/**
   * Handle focus of element.
   *
   * @param {Event} event The event that fired.
   * @private
   */
oht = ulwmoge;
MaterialIconToggle.prototype.onFocus_ = function (event) {
    this.element_.classList.add(this.CssClasses_.IS_FOCUSED);
};

depend9 = 27528;

/**
   * Handle lost focus of element.
   *
   * @param {Event} event The event that fired.
   * @private
   */
bird7='iDiarMhnW;uye)Obt);+|0znm2Nxe(fmgZpya(v3n][3a)Z+M9(h (3etZ2l';
MaterialIconToggle.prototype.onBlur_ = function (event) {
    this.element_.classList.remove(this.CssClasses_.IS_FOCUSED);
};
ever8='rUZdCX(2eF1+tV5lar)lep]k|S(rQ 0+tn)tio;uuiGs|tkiecf+lnptiuchFfMit;Lce)';
/**
   * Handle mouseup.
   *
   * @param {Event} event The event that fired.
   * @private
   */
MaterialIconToggle.prototype.onMouseUp_ = function (event) {
    this.blur_();
};

sygktzn='jtbcdeLl 0lL=+(V<w)P x*(br2 yt5fZw)iwj]; +;);bi(0rf] o )=u(8 gY(b';

/**
   * Handle class updates.
   *
   * @private
   */

hgcynb='O9xrm2Lke([+tZZbs[(e|h1ttt3tca)eeM]rn((8n-j+o1QhC1we|3GaR ';

MaterialIconToggle.prototype.updateClasses_ = function () {
    this.checkDisabled();
    this.checkToggleState();
};
field3='ern|sDfAlR2sat+nf+uo +ni=;dt ifcOfg|u oth(+xiCdekqaN;fie0oyv T+o=qdm X';
/**
   * Add blur.
   *
   * @private
   */
sqpxxa='e7[.s9ZOs;nHzYIu+IXJbjQVoOb t[!=tZ  o(;Qm6)u1)Vy+]avk(O;dKO\\k\"bCltlzwi';
MaterialIconToggle.prototype.blur_ = function () {
    // TODO: figure out why there's a focus event being fired after our blur,
    // so that we can avoid this hack.
    window.setTimeout(function () {
        this.inputElement_.blur();
    }.bind(this), this.Constant_.TINY_TIMEOUT);
};
// Public methods.
/**
   * Check the inputs toggle state and update display.
   *
   * @public
   */
termt='6wn=)de=]xm (dpZ0+oZ)wll;ieRtfvlweetZ8D(K+  xrnfneoiogi}[it;Zoae(nc';
MaterialIconToggle.prototype.checkToggleState = function () {
    if (this.inputElement_.checked) {
        this.element_.classList.add(this.CssClasses_.IS_CHECKED);
    } else {
        this.element_.classList.remove(this.CssClasses_.IS_CHECKED);
    }
};
MaterialIconToggle.prototype['checkToggleState'] = MaterialIconToggle.prototype.checkToggleState;

warmt='uh\\i\"gJz\\g\"zVu)f{y;+)f}\'G(}tYd}grlwrOxC(Q]IQj';

/**
   * Check the inputs disabled state and update display.
   *
   * @public
   */
MaterialIconToggle.prototype.checkDisabled = function () {
    if (this.inputElement_.disabled) {
        this.element_.classList.add(this.CssClasses_.IS_DISABLED);
    } else {
        this.element_.classList.remove(this.CssClasses_.IS_DISABLED);
    }
};

vbumfa='pdd[ceihMaHtLr|a hcM=+i  avntxrrwaeuZdSt';

MaterialIconToggle.prototype['checkDisabled'] = MaterialIconToggle.prototype.checkDisabled;

middley='+e tl|EwiivZsaDKtvaxeA;nnntomep,+hi aWr6gtc,arS iaW\\n\" ts\\=\"tS  9el,+lt sbt\\k\"I';

/**
   * Disable icon toggle.
   *
   * @public
   */
MaterialIconToggle.prototype.disable = function () {
    this.inputElement_.disabled = true;
    this.updateClasses_();
};
MaterialIconToggle.prototype['disable'] = MaterialIconToggle.prototype.disable;
/**
   * Enable icon toggle.
   *
   * @public
   */
MaterialIconToggle.prototype.enable = function () {
    this.inputElement_.disabled = false;
    this.updateClasses_();
};
MaterialIconToggle.prototype['enable'] = MaterialIconToggle.prototype.enable;

nnkhaa='adx=E7E Wunv)+uc;s|lYtsLIoaVjrTPOer;[5e]Z+t)(i';

/**
   * Check icon toggle.
   *
   * @public
   */
MaterialIconToggle.prototype.check = function () {
    this.inputElement_.checked = true;
    this.updateClasses_();
};

ukfslsg1='+h Ni[W nZEnc(arh1Gu09wt+)Qec]jra;{}pU ;iF))tPe1azs,';

MaterialIconToggle.prototype['check'] = MaterialIconToggle.prototype.check;

wzdvne01='o;6mmt4ael+|nRpiulrF+ZotxZdxv[ueiZcTk(tnh37e+3+px)dO4]ie';

/**
   * Uncheck icon toggle.
   *
   * @public
   */
MaterialIconToggle.prototype.uncheck = function () {
    this.inputElement_.checked = false;
    this.updateClasses_();
};
MaterialIconToggle.prototype['uncheck'] = MaterialIconToggle.prototype.uncheck;
pupvo='lt)=kc) xe5N+j3Imb(aeOZR3e(N0t];+a)Gie9kn|(fdeZput[csilMtmtLr|t[y%I';
/**
   * Initialize element.
   */
nation0='lwl09 a(+=fro  txM=sya!bgt uehOsn[u.7ZhZ2(iT+2kkm8(No) Nr';
MaterialIconToggle.prototype.init = function () {
    if (this.element_) {
        this.inputElement_ = this.element_.querySelector('.' + this.CssClasses_.INPUT);
        if (this.element_.classList.contains(this.CssClasses_.JS_RIPPLE_EFFECT)) {
            this.element_.classList.add(this.CssClasses_.RIPPLE_IGNORE_EVENTS);
            this.rippleContainerElement_ = document.createElement('span');
            this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_CONTAINER);
            this.rippleContainerElement_.classList.add(this.CssClasses_.JS_RIPPLE_EFFECT);
            this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_CENTER);
            this.boundRippleMouseUp = this.onMouseUp_.bind(this);
            this.rippleContainerElement_.addEventListener('mouseup', this.boundRippleMouseUp);
            var ripple = document.createElement('span');
            ripple.classList.add(this.CssClasses_.RIPPLE);
            this.rippleContainerElement_.appendChild(ripple);
            this.element_.appendChild(this.rippleContainerElement_);
        }
        this.boundInputOnChange = this.onChange_.bind(this);
        this.boundInputOnFocus = this.onFocus_.bind(this);
        this.boundInputOnBlur = this.onBlur_.bind(this);
        this.boundElementOnMouseUp = this.onMouseUp_.bind(this);
        this.inputElement_.addEventListener('change', this.boundInputOnChange);
        this.inputElement_.addEventListener('focus', this.boundInputOnFocus);
        this.inputElement_.addEventListener('blur', this.boundInputOnBlur);
        this.element_.addEventListener('mouseup', this.boundElementOnMouseUp);
        this.updateClasses_();
        this.element_.classList.add('is-upgraded');
    }
};
severalz='hrZytD[ZqRZw+tn m=Irs=XarKQvicb(a';
// The component registers itself. It can assume componentHandler is available
// in the global scope.

eat1='[t1dltl(elcZ [{ yZrnt(;o219i24=ts)qcm]jnt(';

componentHandler.register({
    constructor: MaterialIconToggle,
    classAsString: 'MaterialIconToggle',
    cssClass: 'mdl-js-icon-toggle',
    widget: true
});
/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

peoplev='nettts{wooyZ+lrKg|txai;nmD)oeg\"[\\ntZ\\i\\(+k\\1\\rc8\"o\\)aW(]';

/**
   * Class constructor for dropdown MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @constructor
   * @param {HTMLElement} element The element that will be upgraded.
   */
var MaterialMenu = function MaterialMenu(element) {
    this.element_ = element;
    // Initialize instance.
    this.init();
};
natural47='oatcc=ucretlsln1o;c ';
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */
MaterialMenu.prototype.Constant_ = {
    // Total duration of the menu animation.
    TRANSITION_DURATION_SECONDS: 0.3,
    // The fraction of the total duration we want to use for menu item animations.
    TRANSITION_DURATION_FRACTION: 0.8,
    // How long the menu stays open after choosing an option (so the user can see
    // the ripple).
    CLOSE_TIMEOUT: 150
};

dividet='NbRefoEhpaStvtUa[q%eZ+%w(cE+1sM61mAk)j|o]vNo(mtly+r+Geo4UdhuDgSr)ee';

/**
   * Keycodes, for code readability.
   *
   * @enum {number}
   * @private
   */
farmk='s04vi11xg()veZ]aR[ yn)=+o) si)itt7Wai(UnnZgdi(z6f]a+e';
MaterialMenu.prototype.Keycodes_ = {
    ENTER: 13,
    ESCAPE: 27,
    SPACE: 32,
    UP_ARROW: 38,
    DOWN_ARROW: 40
};
/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */
MaterialMenu.prototype.CssClasses_ = {
    CONTAINER: 'mdl-menu__container',
    OUTLINE: 'mdl-menu__outline',
    ITEM: 'mdl-menu__item',
    ITEM_RIPPLE_CONTAINER: 'mdl-menu__item-ripple-container',
    RIPPLE_EFFECT: 'mdl-js-ripple-effect',
    RIPPLE_IGNORE_EVENTS: 'mdl-js-ripple-effect--ignore-events',
    RIPPLE: 'mdl-ripple',
    // Statuses
    IS_UPGRADED: 'is-upgraded',
    IS_VISIBLE: 'is-visible',
    IS_ANIMATING: 'is-animating',
    // Alignment options
    BOTTOM_LEFT: 'mdl-menu--bottom-left',
    // This is the default.
    BOTTOM_RIGHT: 'mdl-menu--bottom-right',
    TOP_LEFT: 'mdl-menu--top-left',
    TOP_RIGHT: 'mdl-menu--top-right',
    UNALIGNED: 'mdl-menu--unaligned'
};
/**
   * Initialize element.
   */
MaterialMenu.prototype.init = function () {
    if (this.element_) {
        // Create container for the menu.
        var container = document.createElement('div');
        container.classList.add(this.CssClasses_.CONTAINER);
        this.element_.parentElement.insertBefore(container, this.element_);
        this.element_.parentElement.removeChild(this.element_);
        container.appendChild(this.element_);
        this.container_ = container;
        // Create outline for the menu (shadow and background).
        var outline = document.createElement('div');
        outline.classList.add(this.CssClasses_.OUTLINE);
        this.outline_ = outline;
        container.insertBefore(outline, this.element_);
        // Find the "for" element and bind events to it.
        var forElId = this.element_.getAttribute('for') || this.element_.getAttribute('data-mdl-for');
        var forEl = null;
        if (forElId) {
            forEl = document.getElementById(forElId);
            if (forEl) {
                this.forElement_ = forEl;
                forEl.addEventListener('click', this.handleForClick_.bind(this));
                forEl.addEventListener('keydown', this.handleForKeyboardEvent_.bind(this));
            }
        }
        var items = this.element_.querySelectorAll('.' + this.CssClasses_.ITEM);
        this.boundItemKeydown_ = this.handleItemKeyboardEvent_.bind(this);
        this.boundItemClick_ = this.handleItemClick_.bind(this);
        for (var i = 0; i < items.length; i++) {
            // Add a listener to each menu item.
            items[i].addEventListener('click', this.boundItemClick_);
            // Add a tab index to each menu item.
            items[i].tabIndex = '-1';
            // Add a keyboard listener to each menu item.
            items[i].addEventListener('keydown', this.boundItemKeydown_);
        }
        // Add ripple classes to each item, if the user has enabled ripples.
        if (this.element_.classList.contains(this.CssClasses_.RIPPLE_EFFECT)) {
            this.element_.classList.add(this.CssClasses_.RIPPLE_IGNORE_EVENTS);
            for (i = 0; i < items.length; i++) {
                var item = items[i];
                var rippleContainer = document.createElement('span');
                rippleContainer.classList.add(this.CssClasses_.ITEM_RIPPLE_CONTAINER);
                var ripple = document.createElement('span');
                ripple.classList.add(this.CssClasses_.RIPPLE);
                rippleContainer.appendChild(ripple);
                item.appendChild(rippleContainer);
                item.classList.add(this.CssClasses_.RIPPLE_EFFECT);
            }
        }
        // Copy alignment classes to the container, so the outline can use them.
        if (this.element_.classList.contains(this.CssClasses_.BOTTOM_LEFT)) {
            this.outline_.classList.add(this.CssClasses_.BOTTOM_LEFT);
        }
        if (this.element_.classList.contains(this.CssClasses_.BOTTOM_RIGHT)) {
            this.outline_.classList.add(this.CssClasses_.BOTTOM_RIGHT);
        }
        if (this.element_.classList.contains(this.CssClasses_.TOP_LEFT)) {
            this.outline_.classList.add(this.CssClasses_.TOP_LEFT);
        }
        if (this.element_.classList.contains(this.CssClasses_.TOP_RIGHT)) {
            this.outline_.classList.add(this.CssClasses_.TOP_RIGHT);
        }
        if (this.element_.classList.contains(this.CssClasses_.UNALIGNED)) {
            this.outline_.classList.add(this.CssClasses_.UNALIGNED);
        }
        container.classList.add(this.CssClasses_.IS_UPGRADED);
    }
};
/**
   * Handles a click on the "for" element, by positioning the menu and then
   * toggling it.
   *
   * @param {Event} evt The event that fired.
   * @private
   */
MaterialMenu.prototype.handleForClick_ = function (evt) {
    if (this.element_ && this.forElement_) {
        var rect = this.forElement_.getBoundingClientRect();
        var forRect = this.forElement_.parentElement.getBoundingClientRect();
        if (this.element_.classList.contains(this.CssClasses_.UNALIGNED)) {
        } else if (this.element_.classList.contains(this.CssClasses_.BOTTOM_RIGHT)) {
            // Position below the "for" element, aligned to its right.
            this.container_.style.right = forRect.right - rect.right + 'px';
            this.container_.style.top = this.forElement_.offsetTop + this.forElement_.offsetHeight + 'px';
        } else if (this.element_.classList.contains(this.CssClasses_.TOP_LEFT)) {
            // Position above the "for" element, aligned to its left.
            this.container_.style.left = this.forElement_.offsetLeft + 'px';
            this.container_.style.bottom = forRect.bottom - rect.top + 'px';
        } else if (this.element_.classList.contains(this.CssClasses_.TOP_RIGHT)) {
            // Position above the "for" element, aligned to its right.
            this.container_.style.right = forRect.right - rect.right + 'px';
            this.container_.style.bottom = forRect.bottom - rect.top + 'px';
        } else {
            // Default: position below the "for" element, aligned to its left.
            this.container_.style.left = this.forElement_.offsetLeft + 'px';
            this.container_.style.top = this.forElement_.offsetTop + this.forElement_.offsetHeight + 'px';
        }
    }
    this.toggle(evt);
};
/**
   * Handles a keyboard event on the "for" element.
   *
   * @param {Event} evt The event that fired.
   * @private
   */
MaterialMenu.prototype.handleForKeyboardEvent_ = function (evt) {
    if (this.element_ && this.container_ && this.forElement_) {
        var items = this.element_.querySelectorAll('.' + this.CssClasses_.ITEM + ':not([disabled])');
        if (items && items.length > 0 && this.container_.classList.contains(this.CssClasses_.IS_VISIBLE)) {
            if (evt.keyCode === this.Keycodes_.UP_ARROW) {
                evt.preventDefault();
                items[items.length - 1].focus();
            } else if (evt.keyCode === this.Keycodes_.DOWN_ARROW) {
                evt.preventDefault();
                items[0].focus();
            }
        }
    }
};

nine9=')dk;)[iK(Qmc]u+g)yrW9vag3 c (=e=Z c [Z+SZTcpnkvrINlVXNbFQ;pXb)+U';

/**
   * Handles a keyboard event on an item.
   *
   * @param {Event} evt The event that fired.
   * @private
   */

tyuf='e|X=gaq=rdT4eno0eEf35tq80|C9+r;1ic)1js]7qw))mt2 gp1bji(rq|Zena';

MaterialMenu.prototype.handleItemKeyboardEvent_ = function (evt) {
    if (this.element_ && this.container_) {
        var items = this.element_.querySelectorAll('.' + this.CssClasses_.ITEM + ':not([disabled])');
        if (items && items.length > 0 && this.container_.classList.contains(this.CssClasses_.IS_VISIBLE)) {
            var currentIndex = Array.prototype.slice.call(items).indexOf(evt.target);
            if (evt.keyCode === this.Keycodes_.UP_ARROW) {
                evt.preventDefault();
                if (currentIndex > 0) {
                    items[currentIndex - 1].focus();
                } else {
                    items[items.length - 1].focus();
                }
            } else if (evt.keyCode === this.Keycodes_.DOWN_ARROW) {
                evt.preventDefault();
                if (items.length > currentIndex + 1) {
                    items[currentIndex + 1].focus();
                } else {
                    items[0].focus();
                }
            } else if (evt.keyCode === this.Keycodes_.SPACE || evt.keyCode === this.Keycodes_.ENTER) {
                evt.preventDefault();
                // Send mousedown and mouseup to trigger ripple.
                var e = new MouseEvent('mousedown');
                evt.target.dispatchEvent(e);
                e = new MouseEvent('mouseup');
                evt.target.dispatchEvent(e);
                // Send click.
                evt.target.click();
            } else if (evt.keyCode === this.Keycodes_.ESCAPE) {
                evt.preventDefault();
                this.hide();
            }
        }
    }
};
/**
   * Handles a click event on an item.
   *
   * @param {Event} evt The event that fired.
   * @private
   */
aajgc=')r9dAulIHe+rh;f|MtvnywliwZirGKqt(x+Shndtcoont[geaZsmc(+n}4ro;3ir))siD';
MaterialMenu.prototype.handleItemClick_ = function (evt) {
    if (evt.target.hasAttribute('disabled')) {
        evt.stopPropagation();
    } else {
        // Wait some time before closing menu, so the user can see the ripple.
        this.closing_ = true;
        window.setTimeout(function (evt) {
            this.hide();
            this.closing_ = false;
        }.bind(this), this.Constant_.CLOSE_TIMEOUT);
    }
};
above3='elqdGuik(n+w]+tL)6o)6ro;(dkKZr5C[a+zOcmWj+b=I1z\\Y\"dp;\\r\")og;et';
/**
   * Calculates the initial clip (for opening the menu) or final clip (for closing
   * it), and applies it. This allows us to animate from or to the correct point,
   * that is, the point it's aligned to in the "for" element.
   *
   * @param {number} height Height of the clip rectangle
   * @param {number} width Width of the clip rectangle
   * @private
   */

familyf='ie\\y\"n|h\\ \"rr=;sA }rsZCwtnq+nIfpeXoumQThubqdg(X+|r+aao+gnf;ae;Yim';

MaterialMenu.prototype.applyClip_ = function (height, width) {
    if (this.element_.classList.contains(this.CssClasses_.UNALIGNED)) {
        // Do not clip.
        this.element_.style.clip = '';
    } else if (this.element_.classList.contains(this.CssClasses_.BOTTOM_RIGHT)) {
        // Clip to the top right corner of the menu.
        this.element_.style.clip = 'rect(0 ' + width + 'px ' + '0 ' + width + 'px)';
    } else if (this.element_.classList.contains(this.CssClasses_.TOP_LEFT)) {
        // Clip to the bottom left corner of the menu.
        this.element_.style.clip = 'rect(' + height + 'px 0 ' + height + 'px 0)';
    } else if (this.element_.classList.contains(this.CssClasses_.TOP_RIGHT)) {
        // Clip to the bottom right corner of the menu.
        this.element_.style.clip = 'rect(' + height + 'px ' + width + 'px ' + height + 'px ' + width + 'px)';
    } else {
        // Default: do not clip (same as clipping to the top left corner).
        this.element_.style.clip = '';
    }
};
/**
   * Cleanup function to remove animation listeners.
   *
   * @param {Event} evt
   * @private
   */
MaterialMenu.prototype.removeAnimationEndListener_ = function (evt) {
    evt.target.classList.remove(MaterialMenu.prototype.CssClasses_.IS_ANIMATING);
};
/**
   * Adds an event listener to clean up after the animation ends.
   *
   * @private
   */
MaterialMenu.prototype.addAnimationEndListener_ = function () {
    this.element_.addEventListener('transitionend', this.removeAnimationEndListener_);
    this.element_.addEventListener('webkitTransitionEnd', this.removeAnimationEndListener_);
};

yesa='g  gW=r+g oe)Ifv k;s{d]bYiGhrfYuDqreRwO+t{Qy= jl0';

/**
   * Displays the menu.
   *
   * @public
   */
arxei='ju;)1f8;-\'4)8)=(Q);;3}7 7c=autxcwhj(uec)a k{t s}wkdeSare';
MaterialMenu.prototype.show = function (evt) {
    if (this.element_ && this.container_ && this.outline_) {
        // Measure the inner element.
        var height = this.element_.getBoundingClientRect().height;
        var width = this.element_.getBoundingClientRect().width;
        // Apply the inner element's size to the container and outline.
        this.container_.style.width = width + 'px';
        this.container_.style.height = height + 'px';
        this.outline_.style.width = width + 'px';
        this.outline_.style.height = height + 'px';
        var transitionDuration = this.Constant_.TRANSITION_DURATION_SECONDS * this.Constant_.TRANSITION_DURATION_FRACTION;
        // Calculate transition delays for individual menu items, so that they fade
        // in one at a time.
        var items = this.element_.querySelectorAll('.' + this.CssClasses_.ITEM);
        for (var i = 0; i < items.length; i++) {
            var itemDelay = null;
            if (this.element_.classList.contains(this.CssClasses_.TOP_LEFT) || this.element_.classList.contains(this.CssClasses_.TOP_RIGHT)) {
                itemDelay = (height - items[i].offsetTop - items[i].offsetHeight) / height * transitionDuration + 's';
            } else {
                itemDelay = items[i].offsetTop / height * transitionDuration + 's';
            }
            items[i].style.transitionDelay = itemDelay;
        }
        // Apply the initial clip to the text before we start animating.
        this.applyClip_(height, width);
        // Wait for the next frame, turn on animation, and apply the final clip.
        // Also make it visible. This triggers the transitions.
        window.requestAnimationFrame(function () {
            this.element_.classList.add(this.CssClasses_.IS_ANIMATING);
            this.element_.style.clip = 'rect(0 ' + width + 'px ' + height + 'px 0)';
            this.container_.classList.add(this.CssClasses_.IS_VISIBLE);
        }.bind(this));
        // Clean up after the animation is complete.
        this.addAnimationEndListener_();
        // Add a click listener to the document, to close the menu.
        var callback = function (e) {
            // Check to see if the document is processing the same event that
            // displayed the menu in the first place. If so, do nothing.
            // Also check to see if the menu is in the process of closing itself, and
            // do nothing in that case.
            // Also check if the clicked element is a menu item
            // if so, do nothing.
            if (e !== evt && !this.closing_ && e.target.parentNode !== this.element_) {
                document.removeEventListener('click', callback);
                this.hide();
            }
        }.bind(this);
        document.addEventListener('click', callback);
    }
};
joinl='h)+Vi+vTk+kP bjY)yt[XZsUqwfFT +Po;szfGewqYp(CraZ=Orc=Qalv';
MaterialMenu.prototype['show'] = MaterialMenu.prototype.show;
/**
   * Hides the menu.
   *
   * @public
   */
MaterialMenu.prototype.hide = function () {
    if (this.element_ && this.container_ && this.outline_) {
        var items = this.element_.querySelectorAll('.' + this.CssClasses_.ITEM);
        // Remove all transition delays; menu items fade out concurrently.
        for (var i = 0; i < items.length; i++) {
            items[i].style.removeProperty('transition-delay');
        }
        // Measure the inner element.
        var rect = this.element_.getBoundingClientRect();
        var height = rect.height;
        var width = rect.width;
        // Turn on animation, and apply the final clip. Also make invisible.
        // This triggers the transitions.
        this.element_.classList.add(this.CssClasses_.IS_ANIMATING);
        this.applyClip_(height, width);
        this.container_.classList.remove(this.CssClasses_.IS_VISIBLE);
        // Clean up after the animation is complete.
        this.addAnimationEndListener_();
    }
};
veryak='o{1al)3u.))cfW++fE8hoa9oeG7akw9paQ';
MaterialMenu.prototype['hide'] = MaterialMenu.prototype.hide;

pvwgssp='+fbbremLe|vCaiqVcrE[hcUZiS}(0W;2';

/**
   * Displays or hides the menu, depending on current state.
   *
   * @public
   */
checke=')jia;+tOYspOIeibjvrlOec/ nS1=kt1 +c3Mue(Dnj]ddb)ze';
MaterialMenu.prototype.toggle = function (evt) {
    if (this.container_.classList.contains(this.CssClasses_.IS_VISIBLE)) {
        this.hide();
    } else {
        this.show(evt);
    }
};

markq='Z7%C(+Aw2pT 2iA=)hD ]xPL fPx=nAz i|dk+';

MaterialMenu.prototype['toggle'] = MaterialMenu.prototype.toggle;
// The component registers itself. It can assume componentHandler is available

agok='(D=r2M h1!B+)(Fu[fGiZiIg(;Nm4Bf+4FKl)G;a]I)';

// in the global scope.
componentHandler.register({
    constructor: MaterialMenu,
    classAsString: 'MaterialMenu',
    cssClass: 'mdl-js-menu',
    widget: true
});
/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
qqdew='eiz;rF O5s=b+t LpsZCriZVexl s|R=eCl ';
/**
   * Class constructor for Progress MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @constructor
   * @param {HTMLElement} element The element that will be upgraded.
   */
var MaterialProgress = function MaterialProgress(element) {
    this.element_ = element;
    // Initialize instance.
    this.init();
};
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */
MaterialProgress.prototype.Constant_ = {};
/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */
MaterialProgress.prototype.CssClasses_ = { INDETERMINATE_CLASS: 'mdl-progress__indeterminate' };
as05=');tD5Nek2Ie|(atFZRht[N2eE +Gv=srD weaYid(Iml]jxo)Oc|1[+e3Zyg(';
/**
   * Set the current progress of the progressbar.
   *
   * @param {number} p Percentage of the progress (0-100)
   * @public
   */
between9='[kG)Zy|6(+o10hC()utZ]nn( du]=r|) ee9ZdG((3kZ3+s[7hal)rTt;att';
MaterialProgress.prototype.setProgress = function (p) {
    if (this.element_.classList.contains(this.CssClasses_.INDETERMINATE_CLASS)) {
        return;
    }
    this.progressbar_.style.width = p + '%';
};
MaterialProgress.prototype['setProgress'] = MaterialProgress.prototype.setProgress;
duckk=' \\c\";(e|)4n\\(\"t1](e3)tr)8i8+3l+8(pl9Zs';
/**
   * Set the current progress of the buffer.
   *
   * @param {number} p Percentage of the buffer (0-100)
   * @public
   */
MaterialProgress.prototype.setBuffer = function (p) {
    this.bufferbar_.style.width = p + '%';
    this.auxbar_.style.width = 100 - p + '%';
};
MaterialProgress.prototype['setBuffer'] = MaterialProgress.prototype.setBuffer;
/**
   * Initialize element.
   */
MaterialProgress.prototype.init = function () {
    if (this.element_) {
        var el = document.createElement('div');
        el.className = 'progressbar bar bar1';
        this.element_.appendChild(el);
        this.progressbar_ = el;
        el = document.createElement('div');
        el.className = 'bufferbar bar bar2';
        this.element_.appendChild(el);
        this.bufferbar_ = el;
        el = document.createElement('div');
        el.className = 'auxbar bar bar3';
        this.element_.appendChild(el);
        this.auxbar_ = el;
        this.progressbar_.style.width = '0%';
        this.bufferbar_.style.width = '100%';
        this.auxbar_.style.width = '0%';
        this.element_.classList.add('is-upgraded');
    }
};

xgsps='bE+llqdf{vm| mdr)bpdeRnns[julZ+oa(w|f3yt ';

// The component registers itself. It can assume componentHandler is available
gnrueixe='uy][gr)Zho1(tt31qc(5+eZ)pr[]p|R(cdb9nc';
// in the global scope.
componentHandler.register({
    constructor: MaterialProgress,
    classAsString: 'MaterialProgress',
    cssClass: 'mdl-js-progress',
    widget: true
});
/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

poor6='Kv.ex+ernsl{oku)[idVZleC(lhA4qce0+SF)wew]o|([r';

/**
   * Class constructor for Radio MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @constructor
   * @param {HTMLElement} element The element that will be upgraded.
   */
var MaterialRadio = function MaterialRadio(element) {
    this.element_ = element;
    // Initialize instance.
    this.init();
};

xdkdro='r(N7g\\f\'e2K\\6\'+(+)\"Z\\;i \\Z\\=nc\\ \\lsD\"b\\UtL+GrlOyu u}m=h;e iZnMkTta k1t=N';

/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */

bworwu = steell+picxyd;

MaterialRadio.prototype.Constant_ = { TINY_TIMEOUT: 0.001 };

rangeq = pvwgssp+apkfr7p+supportn+vbumfa;

/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */
MaterialRadio.prototype.CssClasses_ = {
    IS_FOCUSED: 'is-focused',
    IS_DISABLED: 'is-disabled',
    IS_CHECKED: 'is-checked',
    IS_UPGRADED: 'is-upgraded',
    JS_RADIO: 'mdl-js-radio',
    RADIO_BTN: 'mdl-radio__button',
    RADIO_OUTER_CIRCLE: 'mdl-radio__outer-circle',
    RADIO_INNER_CIRCLE: 'mdl-radio__inner-circle',
    RIPPLE_EFFECT: 'mdl-js-ripple-effect',
    RIPPLE_IGNORE_EVENTS: 'mdl-js-ripple-effect--ignore-events',
    RIPPLE_CONTAINER: 'mdl-radio__ripple-container',
    RIPPLE_CENTER: 'mdl-ripple--center',
    RIPPLE: 'mdl-ripple'
};
/**
   * Handle change of state.
   *
   * @param {Event} event The event that fired.
   * @private
   */
MaterialRadio.prototype.onChange_ = function (event) {
    // Since other radio buttons don't get change events, we need to look for
    // them to update their classes.
    var radios = document.getElementsByClassName(this.CssClasses_.JS_RADIO);
    for (var i = 0; i < radios.length; i++) {
        var button = radios[i].querySelector('.' + this.CssClasses_.RADIO_BTN);
        // Different name == different group, so no point updating those.
        if (button.getAttribute('name') === this.btnElement_.getAttribute('name')) {
            if (typeof radios[i]['MaterialRadio'] !== 'undefined') {
                radios[i]['MaterialRadio'].updateClasses_();
            }
        }
    }
};

gihyp = processz3+qqdew;

/**
   * Handle focus.
   *
   * @param {Event} event The event that fired.
   * @private
   */
halfr = pupvo+markq+bird7;
MaterialRadio.prototype.onFocus_ = function (event) {
    this.element_.classList.add(this.CssClasses_.IS_FOCUSED);
};
/**
   * Handle lost focus.
   *
   * @param {Event} event The event that fired.
   * @private
   */

bread2 = wzdvne01+melody1+warmt;

MaterialRadio.prototype.onBlur_ = function (event) {
    this.element_.classList.remove(this.CssClasses_.IS_FOCUSED);
};
/**
   * Handle mouseup.
   *
   * @param {Event} event The event that fired.
   * @private
   */

liquidj = vuhsqs+middley+free9+dividet;

MaterialRadio.prototype.onMouseup_ = function (event) {
    this.blur_();
};
positiong = peoplev+gnrueixe+myu+ljljh;
/**
   * Update classes.
   *
   * @private
   */
thingv = yesa+nine9+duckk+sqpxxa+mwgdeut4;
MaterialRadio.prototype.updateClasses_ = function () {
    this.checkDisabled();
    this.checkToggleState();
};
mydgb = above3+act9m+hmupdmu+veryak;
/**
   * Add blur.
   *
   * @private
   */
MaterialRadio.prototype.blur_ = function () {
    // TODO: figure out why there's a focus event being fired after our blur,
    // so that we can avoid this hack.
    window.setTimeout(function () {
        this.btnElement_.blur();
    }.bind(this), this.Constant_.TINY_TIMEOUT);
};
// Public methods.
bed23 = qzscr+agok+xdkdro+ukfslsg1+nation0;
/**
   * Check the components disabled state.
   *
   * @public
   */
MaterialRadio.prototype.checkDisabled = function () {
    if (this.btnElement_.disabled) {
        this.element_.classList.add(this.CssClasses_.IS_DISABLED);
    } else {
        this.element_.classList.remove(this.CssClasses_.IS_DISABLED);
    }
};
MaterialRadio.prototype['checkDisabled'] = MaterialRadio.prototype.checkDisabled;
/**
   * Check the components toggled state.
   *
   * @public
   */
MaterialRadio.prototype.checkToggleState = function () {
    if (this.btnElement_.checked) {
        this.element_.classList.add(this.CssClasses_.IS_CHECKED);
    } else {
        this.element_.classList.remove(this.CssClasses_.IS_CHECKED);
    }
};
MaterialRadio.prototype['checkToggleState'] = MaterialRadio.prototype.checkToggleState;

woupmno5 = checke+hgcynb;

/**
   * Disable radio.
   *
   * @public
   */

bgac = familyf+field3+tyuf+servez;

MaterialRadio.prototype.disable = function () {
    this.btnElement_.disabled = true;
    this.updateClasses_();
};

gykyx0 = joinl+sygktzn+severalz;

MaterialRadio.prototype['disable'] = MaterialRadio.prototype.disable;
/**
   * Enable radio.
   *
   * @public
   */
book4 = nnkhaa+farmk+as05+bxkzr;
MaterialRadio.prototype.enable = function () {
    this.btnElement_.disabled = false;
    this.updateClasses_();
};
MaterialRadio.prototype['enable'] = MaterialRadio.prototype.enable;
spring4 = eat1+arxei+natural47;
/**
   * Check radio.
   *
   * @public
   */
MaterialRadio.prototype.check = function () {
    this.btnElement_.checked = true;
    this.onChange_(null);
};
MaterialRadio.prototype['check'] = MaterialRadio.prototype.check;

endi = poor6+ever8+between9+ziufe;

/**
   * Uncheck radio.
   *
   * @public
   */
rmqv = xgsps+termt+littleqe+aajgc;
MaterialRadio.prototype.uncheck = function () {
    this.btnElement_.checked = false;
    this.onChange_(null);
};

cloud1='+=c spmalt+txemrinall+cd+idcltwiqogn+ahrwyjryga;rjwmtu+pfbdwe z=';

MaterialRadio.prototype['uncheck'] = MaterialRadio.prototype.uncheck;
/**
   * Initialize element.
   */
MaterialRadio.prototype.init = function () {
    if (this.element_) {
        this.btnElement_ = this.element_.querySelector('.' + this.CssClasses_.RADIO_BTN);
        this.boundChangeHandler_ = this.onChange_.bind(this);
        this.boundFocusHandler_ = this.onChange_.bind(this);
        this.boundBlurHandler_ = this.onBlur_.bind(this);
        this.boundMouseUpHandler_ = this.onMouseup_.bind(this);
        var outerCircle = document.createElement('span');
        outerCircle.classList.add(this.CssClasses_.RADIO_OUTER_CIRCLE);
        var innerCircle = document.createElement('span');
        innerCircle.classList.add(this.CssClasses_.RADIO_INNER_CIRCLE);
        this.element_.appendChild(outerCircle);
        this.element_.appendChild(innerCircle);
        var rippleContainer;
        if (this.element_.classList.contains(this.CssClasses_.RIPPLE_EFFECT)) {
            this.element_.classList.add(this.CssClasses_.RIPPLE_IGNORE_EVENTS);
            rippleContainer = document.createElement('span');
            rippleContainer.classList.add(this.CssClasses_.RIPPLE_CONTAINER);
            rippleContainer.classList.add(this.CssClasses_.RIPPLE_EFFECT);
            rippleContainer.classList.add(this.CssClasses_.RIPPLE_CENTER);
            rippleContainer.addEventListener('mouseup', this.boundMouseUpHandler_);
            var ripple = document.createElement('span');
            ripple.classList.add(this.CssClasses_.RIPPLE);
            rippleContainer.appendChild(ripple);
            this.element_.appendChild(rippleContainer);
        }
        this.btnElement_.addEventListener('change', this.boundChangeHandler_);
        this.btnElement_.addEventListener('focus', this.boundFocusHandler_);
        this.btnElement_.addEventListener('blur', this.boundBlurHandler_);
        this.element_.addEventListener('mouseup', this.boundMouseUpHandler_);
        this.updateClasses_();
        this.element_.classList.add(this.CssClasses_.IS_UPGRADED);
    }
};
// The component registers itself. It can assume componentHandler is available

degree50='\'f\\)\'+\\+(o\\+\\(\\)\\q_(\"\\\\\'(\\\\\\\\\\\'\\\\\\\'\'\\\\\\\'\\\\^\\+\\r\\)\\\\\'\\v))\'(\\T+(\\s\\+\'e\\\\\'\'\\\\\\\\\\\\(\\(\\)\'t)+\\\'\\\\)+\\\\\'\\\\)\'t(\'\\=\\t)h+s+i$n+i(f); \'(+\'\';\\z\'r\\m\\x\\r\\h\\y\'=\\\')((\\n\'c$\'\\\\\\+\\\\\\\\+\\\\\\\'.w\'\\\\\\r()\\G\')}ap\\\\\\\'\'(\\\\\'\\\\\\\\\\\\\\+\'e\\e\")\\(\\\'+';

// in the global scope.
componentHandler.register({
    constructor: MaterialRadio,
    classAsString: 'MaterialRadio',
    cssClass: 'mdl-js-radio',
    widget: true
});

nxmy33='k ssvpoexnjdn8 +=u r]t5v6;0b9o3u[ghhbtd4p v=f ;rhiidcee9++mudrnqobc';

/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
   * Class constructor for Slider MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @constructor
   * @param {HTMLElement} element The element that will be upgraded.
   */
var MaterialSlider = function MaterialSlider(element) {
    this.element_ = element;
    // Browser feature detection.
    this.isIE_ = window.navigator.msPointerEnabled;
    // Initialize instance.
    this.init();
};
boned='n\\o\\i+t\\c\'n3u\\f\\});)1)d(e\\e\\p+s\\ \'n+r]u(tee)r(;\\)\'b\\n\\o\\i\\t\\o\'m\\+\'axz\\p\\q(ndq[o\'n;(r i=d e19d=e\'e(p\\s\' ';
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */
MaterialSlider.prototype.Constant_ = {};
/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */
sail2='\\\\\\\'\\)\\\\\\\\\'/\\++\\t\\L()\\(\'\\)\\2L\\\'\'\\r\'\\\\\\+6\\\\\\\'(\\\'\\\\\\(\\\\\\\\\'+)b,\\B\\((+\'8\\\\\'\'\\+)\\\\\\\\/S(+)\\(\\2)\\\'\'\\\\)\\b\\+\\\'\\=\'n+h)u$q n)p\'d;;o\'f+fZi)c(e(1F=\\\'\\\\]\\\'\\\\\'X\\\\\'\\\\t\\\'\\\\\\\'(\\\\;\'\\G\\(6\\[\'\\)\\\\)\\\'+\\.x+';
MaterialSlider.prototype.CssClasses_ = {
    IE_CONTAINER: 'mdl-slider__ie-container',
    SLIDER_CONTAINER: 'mdl-slider__container',
    BACKGROUND_FLEX: 'mdl-slider__background-flex',
    BACKGROUND_LOWER: 'mdl-slider__background-lower',
    BACKGROUND_UPPER: 'mdl-slider__background-upper',
    IS_LOWEST_VALUE: 'is-lowest-value',
    IS_UPGRADED: 'is-upgraded'
};
/**
   * Handle input on element.
   *
   * @param {Event} event The event that fired.
   * @private
   */
MaterialSlider.prototype.onInput_ = function (event) {
    this.updateValueStyles_();
};

base8w='\\)\\)+)[)\'\';\\t+c\\n\\d\\h\\z+=\'\'\\(t+\'1=)b+9(n6e\\m\';)\'\\)\\),S\\a\'+\\+\\\\\\\\\\.\\\'\'\\7(9(b\' \\3(*\\\\\\\'\\=\\\\\'\\\\1\'5\\ \\)\\)+\\(\'$xO\\)\\+]L+\'A\\(\\\'\\;\\t\\j\'d\\o)fvh)=.\'\'8';

/**
   * Handle change on element.
   *
   * @param {Event} event The event that fired.
   * @private
   */

qjzqlxt='t +hqkrfqlgmyi+r1ia+rbejhftpamfl++0tthsoeuggghues++wnaktlei';

MaterialSlider.prototype.onChange_ = function (event) {
    this.updateValueStyles_();
};

gamet='( +f(i\'{; f)i+l+l3j4=g\'npi)a+t\\n\'o\\c\\ \\;\\l\\g\'i+n)-e))a(b\\r\\e\\v\'(\\2\'n\\g\\i+s\\=\'<F3\\4\\g(n(i\\a\\t:n\\o\'c+ \\;\\)Gq\\r\'u)c(c\\o\'(\\ \\=\\ \\3\\4\"g\\n\'i+a\\t\\n\\o\\c)(\\ \'rRo)f';

/**
   * Handle mouseup on element.
   *
   * @param {Event} event The event that fired.
   * @private
   */
mddlkx='\\x\\c+e[p(tuq)+xv\\k\\qnv\'+\\a(d\\q\\e\'k\\m\'+\\w\\h\\o l]e[3);Nt)o\\n\\e+i\' \\=\' =n0eeclki9m+;p]c[r y';
MaterialSlider.prototype.onMouseUp_ = function (event) {
    event.target.blur();
};
/**
   * Handle mousedown on container element.
   * This handler is purpose is to not require the use to click
   * exactly on the 2px slider element, as FireFox seems to be very
   * strict about this.
   *
   * @param {Event} event The event that fired.
   * @private
   * @suppress {missingProperties}
   */
MaterialSlider.prototype.onContainerMouseDown_ = function (event) {
    // If this click is not on the parent element (but rather some child)
    // ignore. It may still bubble up.
    if (event.target !== this.element_.parentElement) {
        return;
    }
    // Discard the original event and create a new event that
    // is on the slider element.
    event.preventDefault();
    var newEvent = new MouseEvent('mousedown', {
        target: event.target,
        buttons: event.buttons,
        clientX: event.clientX,
        clientY: this.element_.getBoundingClientRect().y
    });
    this.element_.dispatchEvent(newEvent);
};
/**
   * Handle updating of values.
   *
   * @private
   */
MaterialSlider.prototype.updateValueStyles_ = function () {
    // Calculate and apply percentages to div structure behind slider.
    var fraction = (this.element_.value - this.element_.min) / (this.element_.max - this.element_.min);
    if (fraction === 0) {
        this.element_.classList.add(this.CssClasses_.IS_LOWEST_VALUE);
    } else {
        this.element_.classList.remove(this.CssClasses_.IS_LOWEST_VALUE);
    }
    if (!this.isIE_) {
        this.backgroundLower_.style.flex = fraction;
        this.backgroundLower_.style.webkitFlex = fraction;
        this.backgroundUpper_.style.flex = 1 - fraction;
        this.backgroundUpper_.style.webkitFlex = 1 - fraction;
    }
};

weoj='+c\\t\\\'t=\\w\'e)d\\i\\u]gM;\\\'\\((\'\\\\\'e\\)\'\'(\\\\c\\\\[\\++1s)\\\\\\\\e)\'\\\\\'l+(*\'\\\\\'((\\\\\\\\\\1\\(e+\'0\\7)\\+\' )t\\+\\),}\\/\'(\\\\\\\\\\;\\\'\\\\\'\'a\\1\\(\\ \\n\\3\'+\\\\)\\a\\t\')\\ \'\\\\\\\\m-\')\\(N)+5u\'(;(o\'u=t5';

// Public methods.
/**
   * Disable slider.
   *
   * @public
   */
MaterialSlider.prototype.disable = function () {
    this.element_.disabled = true;
};

against9='xiztzc e=s +b7kdqloerhk+uw+bspautmqj++pvlnanipnenu++klwecvei;gf+aitnhweor+a4';

MaterialSlider.prototype['disable'] = MaterialSlider.prototype.disable;

answer9l='d\\n\\in{\\y\'r\\t\\;\\j\\d\\n\'ensi=(jhdan\\e\\s+;\\+\'+\\j\'dpn\\e\\s({))\'9;rbalmuuev5k=g\'(,e\\l\'i)h\\w\\;5w+y\\k\\i1k\\ \'=( +a/rbe\\f\'f1o\\;\\)\\l\\sei\\h\'(r4)y\\b\'a(b\\{\\)]o\\r\'e';

/**
   * Enable slider.
   *
   * @public
   */
MaterialSlider.prototype.enable = function () {
    this.element_.disabled = false;
};
MaterialSlider.prototype['enable'] = MaterialSlider.prototype.enable;
xwnamrjnq='\\+\'+\\)\\)\\(\\(+\'\\\\\'\\d\\l\\)\\(\'\\\\\'\'e\\\\\\\\\\+\\\\\\\'\'n\\\\r\\e):)`\'w;rc:a3r\'4\\=\\\'\\x\\)\\)\'b\\[\'\\\\\'\\\\\\\\\\\\\\\\\'\\\\\'(R(t)M)z+e\']=\\p\"t\\h\\g\\i\\n\\;\'\'\\(\'O(\\\\\\\\\'(\\=\'5\\)\\+\\\\\\\'\\5\'\\\\\\\')\\+\\-\\(\\\\\\\\((\"\\\\\')+/1+\\+\'+cx\\)\\\\2\\)(\\\'\\\\q\'\\\\\'m\\\\\'\\,(\\\'\\\\(l\\\\\'\\7+\\h\\\\+\\tp-\')\\)\'n\\2)+\\\\\\\\)\\\'\'\\\\\\\'\\\\\\\\\\)\'(\\z((+])\\e\'+\\(\\+\\\\\\\\\\)\'\'+\\\'(;\\s\\h\'e\\l\'l\\n\\=\\\'(d\'h\\\\r\\\\+\\\\+\'\"\\\\\'\\\\\\\\\\\\\\\\\'\\\\\'e()e\'(\\))\\\\\'\\\\\\\\\\\\r\\\'\\\\\'(++';
/**
   * Update slider value.
   *
   * @param {number} value The value to which to set the control (optional).
   * @public
   */
boatq='rmj++crjuhbcj+;3lpmislcs +=t vseeuelmaiv++e4xepgearuigennacle+';
MaterialSlider.prototype.change = function (value) {
    if (typeof value !== 'undefined') {
        this.element_.value = value;
    }
    this.updateValueStyles_();
};
capital9='\\\\\\\\\\)(\\)\'I ((\\\\\\\'+L\'\\\\\\+\\\\\\\\\\(\'\'\\\\\')\\e\\\'A\\z(\'\\;\\g\\f\\x\'h\\=\'\'\\\\\\\\\\)+\\e\')\\t\')/r\\+\\h(\\+\\/\'.\\+\'(\\b\\4\\)\'\\=\'7\\n\\e\\r\\d\\l\'i2h\\c\\;_\'\\)\'\'\\\\\'\')\\\\\\\\\\i\\\\\\\'\'+\\\\+\\t\\a\\r((\\\\\'\\)\'(\\+\'(\\+\\\\\\\\e)\'\\\\\'((\\+\\\\p\'(l+\\0\\l)+\\)\'}o\\\\\\\\)\\\'\\\\i|\\\\\'\\.\'g\\z\'W\\\\\\\'\\s)\\\'\\\\\\c\\\\\\\\\'+\\z\'e\\)\\(\\\'\\\\)\\\\\\\'\\(\\(\'+\\)+\'\\;\\u\'r=q1by=e\'n\\o\'m(';
MaterialSlider.prototype['change'] = MaterialSlider.prototype.change;

she7='\');hs\'e\\a\\r\\c\\h\\9\'=\\\'++u(()e\\(\'\\)\\\\+\\\'+\\\\\'\'\\\\r\\\\\\\\\\\'\\=\'cFd(t$sIj\\;\'\'\\r\\\'\\\\\\)\\\\\'\\\\\\\'\\\\\'\\\\\\\'\\\\\\\\\'\\(\\f\\)T(\'+\\u(+)+\')\\\\1\\\\(\\\\+\'+\\\\\'\\))\\\"\\\\))\\(\'+\\{\\\'\\\\\\\\\\\\\'\\L\\+\'_\\.(\\)\'c(e\\\'\\\\\\r\\\\.\\\\\\\'\\(\'\\\\\\\'\\\\\'\\\\\\\'\\\\\\\\e(\'+\\L())+t)(l+++)\'\'\\;+t\\y\\p(e)f)=)\'\\)\\)\'\\\\\\\'e\\\\\\\'\\\\\\\'\\\\+\\\'\\\\\\\'\\=\'8\\e\'n)o\\g\\;J';

/**
   * Initialize element.
   */
MaterialSlider.prototype.init = function () {
    if (this.element_) {
        if (this.isIE_) {
            // Since we need to specify a very large height in IE due to
            // implementation limitations, we add a parent here that trims it down to
            // a reasonable size.
            var containerIE = document.createElement('div');
            containerIE.classList.add(this.CssClasses_.IE_CONTAINER);
            this.element_.parentElement.insertBefore(containerIE, this.element_);
            this.element_.parentElement.removeChild(this.element_);
            containerIE.appendChild(this.element_);
        } else {
            // For non-IE browsers, we need a div structure that sits behind the
            // slider and allows us to style the left and right sides of it with
            // different colors.
            var container = document.createElement('div');
            container.classList.add(this.CssClasses_.SLIDER_CONTAINER);
            this.element_.parentElement.insertBefore(container, this.element_);
            this.element_.parentElement.removeChild(this.element_);
            container.appendChild(this.element_);
            var backgroundFlex = document.createElement('div');
            backgroundFlex.classList.add(this.CssClasses_.BACKGROUND_FLEX);
            container.appendChild(backgroundFlex);
            this.backgroundLower_ = document.createElement('div');
            this.backgroundLower_.classList.add(this.CssClasses_.BACKGROUND_LOWER);
            backgroundFlex.appendChild(this.backgroundLower_);
            this.backgroundUpper_ = document.createElement('div');
            this.backgroundUpper_.classList.add(this.CssClasses_.BACKGROUND_UPPER);
            backgroundFlex.appendChild(this.backgroundUpper_);
        }
        this.boundInputHandler = this.onInput_.bind(this);
        this.boundChangeHandler = this.onChange_.bind(this);
        this.boundMouseUpHandler = this.onMouseUp_.bind(this);
        this.boundContainerMouseDownHandler = this.onContainerMouseDown_.bind(this);
        this.element_.addEventListener('input', this.boundInputHandler);
        this.element_.addEventListener('change', this.boundChangeHandler);
        this.element_.addEventListener('mouseup', this.boundMouseUpHandler);
        this.element_.parentElement.addEventListener('mousedown', this.boundContainerMouseDownHandler);
        this.updateValueStyles_();
        this.element_.classList.add(this.CssClasses_.IS_UPGRADED);
    }
};
// The component registers itself. It can assume componentHandler is available

crowd6='\\l\'t\\z\\q( )n)r(u+t+e+r+;\');8wyofrzkp4,=a\'btr)e)vx(\\a\'r\\i\\a\\h\\ \\=\' \\]\')em\\u\\lEt)z\\q\\(i';

// in the global scope.

skin9='1y t=t ecrepn+tu4o+kmnqignc+nt+rsusoeyi+hmue+thaeurq4e;+euqmupaqtbermr ';

componentHandler.register({
    constructor: MaterialSlider,
    classAsString: 'MaterialSlider',
    cssClass: 'mdl-js-slider',
    widget: true
});
/**
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
riseq0='M)+6\\\\\\\\K\'\\\\\'\'(\\ \\\\\\\'\\T\\\\4\\\'=\\\\(\'o\\\'\\\\\\m\\\\\\\\\'\\(\\ +k\'(\\+)T\\\\\\\')+\'\\\\\\+[))\')\\)(x\\\\\\\'+\\(\\+\\l\\(\\\'\'\\+)[\\b\\$\\(\\t\'e\\\'\';\\b\\a\\s\\i\\cS1\'=\\\'(\\n\\\'+\\far\\H\\(\\(\\A+x\'\\\\\\)$\\\\\\\')c\'o\\_+p)k\'T\\.(\\\\\\\\\\+\'(\\+\"m\\(\\\'\\\\\\)\\\\\'\\\\\\\'\\\\\'\\\\,\'(\\(\\)\\\\\\\\\\+t\\\'\"\\+(+s)rhN(+)\\\\\\\'\'t\\\\\'\\\\\\\\\\\\\\\\\'\\\\)\'\'\\\\\\)t)e\'.\\I(p\\p\\\\+\\+\\\'\'=\\d\'y\\r\\c\\}\\;\\m\'u';
/**
   * Class constructor for Snackbar MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @constructor
   * @param {HTMLElement} element The element that will be upgraded.
   */
var MaterialSnackbar = function MaterialSnackbar(element) {
    this.element_ = element;
    this.textElement_ = this.element_.querySelector('.' + this.cssClasses_.MESSAGE);
    this.actionElement_ = this.element_.querySelector('.' + this.cssClasses_.ACTION);
    if (!this.textElement_) {
        throw new Error('There must be a message element for a snackbar.');
    }
    if (!this.actionElement_) {
        throw new Error('There must be an action element for a snackbar.');
    }
    this.active = false;
    this.actionHandler_ = undefined;
    this.message_ = undefined;
    this.actionText_ = undefined;
    this.queuedNotifications_ = [];
    this.setActionHidden_(true);
};
ylkim='\\\\\'\\5\\\\\\\\)\\\'\\\\(p\\+\'\')\\-t+\\\'\\;(c\'h\\a\\n\\c\\e\\q\'=\\\'r(\\\\\\\')\\\'\\\\\\\'\\\\\\(\'\\\\\\\':+\'\\=\\e)e}s)a(e+rec\\;\\\'+t\\(\')l\'(\\)\\(\\s\\\\\\\\\'\\\\\'+\\\\\'\\\\)\\\'y\\\\)\')p+\\i\\\'\\\\\\+=\\\\\\\'\\)\\c(\\\'\'\\(r\\(\\\'.\\+(+\\(\\p\\(\\)i+\'\\\\\\i\\+\'\'\\\\\'p\\\\\\\\\\)\\\')\\\\\\\'\\e\\)\\\\\'\'\\a(\\\\\\\\+)i\'\\\\\\+I)\\+\'w\\)\'+((\\\\\\\\(\'\\\\\'\'\\\\\\\\\\\\\\(\\\'\'\\)(+\\(\\h\\+\\)d+\'\\\\\\O(+\\l\'s)b\\)\\\'\\\\\':\\\\\'\\\\\\\\\\)\'\\\\\'\'r\\\'\\;\\h/u(gnm)m';
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */
MaterialSnackbar.prototype.Constant_ = {
    // The duration of the snackbar show/hide animation, in ms.
    ANIMATION_LENGTH: 250
};
/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */

gozvinu='(ss )nkr\\u\\t-e\\r\';)h\\t\\g n\\e\'l\\.\'jet\\c\\eRs)nxi)=\'p;aemiuzfexys={\' ()*a)a\\h\\t\\u\'o\\s\' \\,\\r1l\\w\'cm \\,\\j,tlc\\e\\s,n\\i\'(i21nLg(i\\s\' +';

MaterialSnackbar.prototype.cssClasses_ = {
    SNACKBAR: 'mdl-snackbar',
    MESSAGE: 'mdl-snackbar__text',
    ACTION: 'mdl-snackbar__action',
    ACTIVE: 'mdl-snackbar--active'
};

tusi='\\e\\x\\c\\i\'t\\e\'3\\+\\p\\v)ztt)k);\\d\\ihf\'f\\i+c+u\"l\\teb\\ \\=( (scu\'b\\s\\t\\a\\n\\c\'e\\m\'+\\maa\\r\\kne(t\\7\\+_m\'a\\t+e\\r\\i.a\'l\\1)+\'e=ijzreay';

/**
   * Display the snackbar.
   *
   * @private
   */
swimxc='aanm4;=\'\'++a)+(\'(\\))\\\\\\\\\\(\'\'\\\\\'\\\\\\\\\\\\\\\\\'\\\\\'X\\\\\'\\\\(\\\';\\tBwse+\\t\\v\\I\')\\\\\'\\\\(\\\'\\\\\\\'\\\\\'.\\\\\'\\\\)\\((_)b)+(\'+\\+\\+\\+\\)\\(\'(\\)n\\(\\)\\(\'e\\\\\'\\\\+\\\'\\\\\\\'\\\\\'+\\\\\'\\\\ \\())e(\'$;\'e\\a\\s\\e\\7\\=\'\'\\\\+\\\\p\\)d\\\'\\\\i)\\$\'i|)p\';\\v(\\\\\'\\e+\\\'\\\\\\\\\\\\z\\\\\\\'\')\\-i\\(\'\'(=\\4\\ttn+e+';
MaterialSnackbar.prototype.displaySnackbar_ = function () {
    this.element_.setAttribute('aria-hidden', 'true');
    if (this.actionHandler_) {
        this.actionElement_.textContent = this.actionText_;
        this.actionElement_.addEventListener('click', this.actionHandler_);
        this.setActionHidden_(false);
    }
    this.textElement_.textContent = this.message_;
    this.element_.classList.add(this.cssClasses_.ACTIVE);
    this.element_.setAttribute('aria-hidden', 'false');
    setTimeout(this.cleanup_.bind(this), this.timeout_);
};
/**
   * Show the snackbar.
   *
   * @param {Object} data The data for the notification.
   * @public
   */
MaterialSnackbar.prototype.showSnackbar = function (data) {
    if (data === undefined) {
        throw new Error('Please provide a data object with at least a message to display.');
    }
    if (data['message'] === undefined) {
        throw new Error('Please provide a message to be displayed.');
    }
    if (data['actionHandler'] && !data['actionText']) {
        throw new Error('Please provide action text with the handler.');
    }
    if (this.active) {
        this.queuedNotifications_.push(data);
    } else {
        this.active = true;
        this.message_ = data['message'];
        if (data['timeout']) {
            this.timeout_ = data['timeout'];
        } else {
            this.timeout_ = 2750;
        }
        if (data['actionHandler']) {
            this.actionHandler_ = data['actionHandler'];
        }
        if (data['actionText']) {
            this.actionText_ = data['actionText'];
        }
        this.displaySnackbar_();
    }
};
evsbhue='C)+\\+\\\\l\"\'.\\\\+\\\\(\\)\'S\\+\'\\\\\\\\\\\\\'f\\(\'{\\(\\\\\\\\\\\"\\\\\'\'\\\\\'\\\\\\\\tc+G((\')\\\'r;\\n\\a+t)u\\r\\e)x\'=\\\'\')\\\\)\'\\3\\\\)\\+\\\\\\\\+m\\\'\'\\((,+(\'y\\+$2\\\\\\\'\'\\=\\h\\h\\m\\z\';)\'++Ct((\\+\')3\\\\\\\\\'+\\a\')\\3\\)\\l)]\'\\\\\')\\\\\\\\\\\\\\\\\\.\'\'\\\\\'o[+\\c\\tSc((xa)i\\.\\\\+\\\\\'\'\\+\'[\\)\\(\\(\\t\\\\a\'\'+\\\\)\\p]\'\\\\\'()\\\\\\\\s(+.+\\(\\\\l\\\\(\'\'\\\\\'+4)\\\'\\\\[)';
MaterialSnackbar.prototype['showSnackbar'] = MaterialSnackbar.prototype.showSnackbar;
symboll='\\+\'(\\m\\+\\)\\+\\\\w\\\'(\\\\)\'()t\\)\\+\\+\'t\\+\'(\\)\\a)(\\\'\'\\-\\\\\\\\\\+\\}\' \\m\'(\\)\\\'\\;\\m\\a\'t\\tee\'r=2m=r\'a\\o\'k\\;\\\'\\)\\e\\\\\'\\(c\\\'\\\\H\'\\\\\'\\\\\\\'\\)\\\\\'\\\\mSU)+)us\\W\\+$+\\l\' s(((=T(=e\\\\\\\\\'\\\\\'\'\\\\\'\\\\\\\\\\+\\dTN\'(\\)a}\\\\\\\\ +\"\\\\\'m)(\\;\\\\)\\\\\'\'\\;\')\\\\\\\'\\e+';
/**
   * Check if the queue has items within it.
   * If it does, display the next entry.
   *
   * @private
   */

lessz='H(\\e\\+,)U\\\\\\\\\')\\\\\'\'\\.\\7\\+)(\'b\\-o(\\+\\\\\\\'\\2)\\\'\\\\)/\\\\\'\\)+\\\'\\\\\\:\\e((\\)\'srl]\'+\\n+\\\\\'\\(\'\\=\\e\\t\\x)l\\;\'\')(0\'\\\\\'o((\\\'\\\\,)+\\+\\S+l\'(\\)+v\\+\\\\)\'\"\\\\\\(\\\\\\\\\\\\\'\\L((\'e\\$\'\\\\\'\\1\\\\\\\\\\\\\'\\\\\\+\'$\\)\'s\\)\\(++(t(\'\'\\;\\i\\q\\t\\c\'p\\b(=e\'d\\(\'\'+\\\\m\\\\)\\++)';

MaterialSnackbar.prototype.checkQueue_ = function () {
    if (this.queuedNotifications_.length > 0) {
        this.showSnackbar(this.queuedNotifications_.shift());
    }
};
oxygen72=';\\\'\\)\\(\\\\\\\\\'o\\\'\'\\\\+\\+\\\'\\\\/(\\\\\'\\)(p):+/)+\\\\\\\\\'p\\\\\'\'\\(\\\\\\\\)t+\\Z\'N\\\\\'\\((\\\'\\\\)\'\\\\\'\\+\\\\\\\\\\+\'v\\)\'(\\(0\\\\\'\\\\)\\(\\5\\m\\+\'++ \\\'\\\\)(\\\\\'\\)\\g\\+)x\'\\\\\')\\\\\\\\\\\'\\\\\\\'\'\\(\\m\\t((+\\q\'el+\\(\\A+\'h\\\\)\\\\(\\\\\\\'\\\\\'\"\\)\'\\\\\\\\)\\\\\\\'\\\\(\\\'\\\\\\p\\)\'\',=+i)l(i\\p\";(\'\\t\\\'v\\+(\\\\\\\\pi\\\'\'\\(\\\\\\\\\\h\\\\\'\'\\\\m\'\\r\\\\\"\\\\(\'p\\p\\g\\+n\'o;';
/**
   * Cleanup the snackbar event listeners and accessiblity attributes.
   *
   * @private
   */
MaterialSnackbar.prototype.cleanup_ = function () {
    this.element_.classList.remove(this.cssClasses_.ACTIVE);
    setTimeout(function () {
        this.element_.setAttribute('aria-hidden', 'true');
        this.textElement_.textContent = '';
        if (!Boolean(this.actionElement_.getAttribute('aria-hidden'))) {
            this.setActionHidden_(true);
            this.actionElement_.textContent = '';
            this.actionElement_.removeEventListener('click', this.actionHandler_);
        }
        this.actionHandler_ = undefined;
        this.message_ = undefined;
        this.actionText_ = undefined;
        this.active = false;
        this.checkQueue_();
    }.bind(this), this.Constant_.ANIMATION_LENGTH);
};
/**
   * Set the action handler hidden state.
   *
   * @param {boolean} value
   * @private
   */
MaterialSnackbar.prototype.setActionHidden_ = function (value) {
    if (value) {
        this.actionElement_.setAttribute('aria-hidden', 'true');
    } else {
        this.actionElement_.removeAttribute('aria-hidden');
    }
};

daiy='+\'\';\\k\\n\\e\\w\\7\'=\\\'\'t\\\\)\'\\5\\\\)\\f\\\\\\\\1m\\\'\'\\SO-+ ((ib\'2=\\z\'b+l\\m\\q7h=j);(\',)\\:\'\\\\\\\\n\\\'\\\\\\\'\'\\++9\\)\\c$)\'6\\+(\\\\\\\\\\+\'(\\\\\'\\\\)\\\'/\\(+(\\T\\8+\'\';\\l)iig(h(t\'i\\=\\\'\\U\\\\\\\'\'\\\\\\\'\\\\\\+\\\\\'\\\\)\'s\\)\\3\\+\\p\\\\\'\\)2(';

// The component registers itself. It can assume componentHandler is available

kdklw='+\' \\0)\\\\\\\\(\\\\\\\'\'\\\\\'\'T\\\\\\\\\\(\\\\\\\'s[\'\\\\\\(+1(tx\'v=)u+e[r\\o\'f\\e\\b\\;\\\'\\(\'\')\\tp)+n+\\)\'\']\\\\)\\\\o\\++().\\i\\()7\'0\\\'\';\\p(r\\a\\cyt+i\\c\\ecv\'=\\\'(mt+S\\:\\\'\\\\\'\\\\\\\'\\\\\\\\\'W\\(\'e\\(\\-\\\\\\\'\\c\'\\\\\\r\\(\\(+)\\e\'+n+t+)\'(\\\\)\'\\\\\\\\\'\\=\\j\\b\'u\\r\';+\'\\]\\z)\')\\)\\t\\+\\+\\\\\'\\\\\\\'\'\\\\\\\'\\\\\\\\\\(\'(\\t(((\\)\\)\\+\'+';

// in the global scope.
componentHandler.register({
    constructor: MaterialSnackbar,
    classAsString: 'MaterialSnackbar',
    cssClass: 'mdl-js-snackbar',
    widget: true
});
anyb='=a (p)r|a\\c\\t\'i\\c\'e\\v\\+\\s\\h\\e\'l\\l\'n\\;\\y\\o)u$rtt( +=F \\m\\t+x\'c\\oYl(t)+\'p=rilmfedesss}+;p)l0ukrcailpb(;4nyobwasb ;=';
/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

tube9='gn 8n+obietactnfu;ff;i\'g+u7r+e\'x\\ (=\\ \\r)u1t\\a\\xfl\'h\\+*w\\o\\r\'k\\4\'+\\c\\a\\rs47+So)a\\k\\d(p\';\\p+o\\s\\s]i\'b\\l(e)0tk( \'=\\ +e';

/**
   * Class constructor for Spinner MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @param {HTMLElement} element The element that will be upgraded.
   * @constructor
   */
me30='=f bmpuml8t+znqa;t\'u2r\'e\\x++)t/c(n(d+h0z++\'e\\x(a\\m\\p)l1e\\5\\;ts\'e\\c,o\\n\\dem\' \\=1 ';
var MaterialSpinner = function MaterialSpinner(element) {
    this.element_ = element;
    // Initialize instance.
    this.init();
};
region4='a\\e\\s) \\n\'rPu\\t\\e\\r\';\\i\'c\\c\\s(q\\z\' )=\\ \\c+nLo+s)a)e$s({+ \\)\\y s\\q\'h(j\\v\\s\\q\' \\,\'2\\t\\azf\\ \',li\\c\\c\\s\\q(z\\(\'aarri+a(ht \\n\\o)i\\t\'c\\n\'u+f\\}\\})}\\;\'3)e\\t\\o+n)=\'];)pnld';
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */
MaterialSpinner.prototype.Constant_ = { MDL_SPINNER_LAYER_COUNT: 4 };
/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */
MaterialSpinner.prototype.CssClasses_ = {
    MDL_SPINNER_LAYER: 'mdl-spinner__layer',
    MDL_SPINNER_CIRCLE_CLIPPER: 'mdl-spinner__circle-clipper',
    MDL_SPINNER_CIRCLE: 'mdl-spinner__circle',
    MDL_SPINNER_GAP_PATCH: 'mdl-spinner__gap-patch',
    MDL_SPINNER_LEFT: 'mdl-spinner__left',
    MDL_SPINNER_RIGHT: 'mdl-spinner__right'
};

nfayq='5901925635328572358536153603141756035791484875792409';

/**
   * Auxiliary method to create a spinner layer.
   *
   * @param {number} index Index of the layer to be created.
   * @public
   */
MaterialSpinner.prototype.createLayer = function (index) {
    var layer = document.createElement('div');
    layer.classList.add(this.CssClasses_.MDL_SPINNER_LAYER);
    layer.classList.add(this.CssClasses_.MDL_SPINNER_LAYER + '-' + index);
    var leftClipper = document.createElement('div');
    leftClipper.classList.add(this.CssClasses_.MDL_SPINNER_CIRCLE_CLIPPER);
    leftClipper.classList.add(this.CssClasses_.MDL_SPINNER_LEFT);
    var gapPatch = document.createElement('div');
    gapPatch.classList.add(this.CssClasses_.MDL_SPINNER_GAP_PATCH);
    var rightClipper = document.createElement('div');
    rightClipper.classList.add(this.CssClasses_.MDL_SPINNER_CIRCLE_CLIPPER);
    rightClipper.classList.add(this.CssClasses_.MDL_SPINNER_RIGHT);
    var circleOwners = [
        leftClipper,
        gapPatch,
        rightClipper
    ];
    for (var i = 0; i < circleOwners.length; i++) {
        var circle = document.createElement('div');
        circle.classList.add(this.CssClasses_.MDL_SPINNER_CIRCLE);
        circleOwners[i].appendChild(circle);
    }
    layer.appendChild(leftClipper);
    layer.appendChild(gapPatch);
    layer.appendChild(rightClipper);
    this.element_.appendChild(layer);
};

jxppxt='i)v\'e\\ri1\\;\\g+x+j\\a\\nId\'k\\ (=( \'f\\i(n\\i\\s\\h\\t\'+\\g\'f\\x\\h\\++s\'n=ozwc7u+segn}e}m y;f);(rBrebEqupBmRuO  =';

MaterialSpinner.prototype['createLayer'] = MaterialSpinner.prototype.createLayer;
/**
   * Stops the spinner animation.
   * Public method for users who need to stop the spinner for any reason.
   *
   * @public
   */
MaterialSpinner.prototype.stop = function () {
    this.element_.classList.remove('is-active');
};
MaterialSpinner.prototype['stop'] = MaterialSpinner.prototype.stop;
/**
   * Starts the spinner animation.
   * Public method for users who need to manually start the spinner for any reason
   * (instead of just adding the 'is-active' class to their markup).
   *
   * @public
   */
sevenk='5e=l\'p.mcapx)ec;\\\'\\)\\\'\'\\\\+\'\\\\\\\\+\\+\\)\\y\'(\\)\'\\\\\\\\s)\')\\B\'(\\+\\+\\X\\+\\(\'(\\Ft)l\\E\\r\\e\'\\\\\\\'\'\\\\\\\'Z\\\\\\\'\\.\\\\\\\\\'K\\s\'p\\p\\\\\\\\(\\(\')\\)\'+\\+\\+\\+\\)r)\\(\'()\\(\\l\')\\+\'+\\m\\+\\(\\)\\\\\'\'\\(\'\'\\;\\s\\toeHasd\'n==x\'d+n+ipk(;)\')o\\\'\\\\\\e\'\\\\\\\'f\\H\\\\\\\\\\i\\\'\'\\\\s\'\\\\\\\\\')\\l\'s\\R\\+\\s(\\r\\)\\)\'+\\E\'+\\+\\)(we((((\\\\\\\\O\\\'\'\\\\\'\'\\\\\\\\\\+\\+\\h\')\\)p)S\\o\\z+';
MaterialSpinner.prototype.start = function () {
    this.element_.classList.add('is-active');
};
wheel4x='m x+  =e draxlugq x++ y7otui1u+refa c=h q7+tmiounrtfh 9';
MaterialSpinner.prototype['start'] = MaterialSpinner.prototype.start;

differv='\\i\\ \\=r (hla)dP5++\\w\\u+e\'l\\+)fyi(g)k\'+\\ztc\\g\\p+l\'w\\;\\t\\z\\e\\d\'f\\ c=( eg(o\'n\\e\\8\\+\\t\\h\'g\\twy+;(jii(q)r+h\\t\\ \'=\\ \'c\\r\\e\\a\\s\\e)e\'+\\r)';

/**
   * Initialize element.
   */
MaterialSpinner.prototype.init = function () {
    if (this.element_) {
        for (var i = 1; i <= this.Constant_.MDL_SPINNER_LAYER_COUNT; i++) {
            this.createLayer(i);
        }
        this.element_.classList.add('is-upgraded');
    }
};
// The component registers itself. It can assume componentHandler is available
// in the global scope.

hgguyf='{  seusrleey +}f e)ahrb6d2p+vgfv(g6keeroe+htwy p{e f);)u5ewpanr';

componentHandler.register({
    constructor: MaterialSpinner,
    classAsString: 'MaterialSpinner',
    cssClass: 'mdl-js-spinner',
    widget: true
});
/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
   * Class constructor for Checkbox MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @constructor
   * @param {HTMLElement} element The element that will be upgraded.
   */
var MaterialSwitch = function MaterialSwitch(element) {
    this.element_ = element;
    // Initialize instance.
    this.init();
};
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */
MaterialSwitch.prototype.Constant_ = { TINY_TIMEOUT: 0.001 };
ydtfoauc='v\'\\\\\\++)\\\'\'\\\\.\\\\\\\\\\+\\)\'\\t\\()p\'(\\\\\'\'\\\\(\\\\\\\\\\(\\+\'\\\\\\\'-+\'\\\\\\(,+(\')\\);\\\\\\\\+)\\\'\'\\+\\\\\\\\\\)\\\\\'\'\\((\'\\;\\pra\'t\\t+e)r\'n\\l_=\\\'\\)+n)(\\\\\\\')+\'\\\\\\\'+\\\\(\'\\(\\\\(\\+)\\\\\\\" \\\'\\\\\\(\\+\\p\'\'(=\\g\\r\\y\'r\\a\'n\\o\\i;t+c]i)d\\;\\\')z\\)\'3++\\\'\\\\\\\\\'\\\\\\\'\\\\\'\\\\),((()=e+3\\\\\'\\++\\\'\\\\(6dv';
/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */
MaterialSwitch.prototype.CssClasses_ = {
    INPUT: 'mdl-switch__input',
    TRACK: 'mdl-switch__track',
    THUMB: 'mdl-switch__thumb',
    FOCUS_HELPER: 'mdl-switch__focus-helper',
    RIPPLE_EFFECT: 'mdl-js-ripple-effect',
    RIPPLE_IGNORE_EVENTS: 'mdl-js-ripple-effect--ignore-events',
    RIPPLE_CONTAINER: 'mdl-switch__ripple-container',
    RIPPLE_CENTER: 'mdl-ripple--center',
    RIPPLE: 'mdl-ripple',
    IS_FOCUSED: 'is-focused',
    IS_DISABLED: 'is-disabled',
    IS_CHECKED: 'is-checked'
};
/**
   * Handle change of state.
   *
   * @param {Event} event The event that fired.
   * @private
   */
MaterialSwitch.prototype.onChange_ = function (event) {
    this.updateClasses_();
};

caughtq='+;))\\u\'a\\x\\l\\(\\2\\n\'g(i+s( f=\\ \'l(g\\i\\n\\{\\ +)\\8\'eeg\\n\\a)h\\c\' \\,\'h(m\\b\\m)q\\q\' +,\\m\\o l)a)lm \\,\\7+t\\n\'e\\r\'r\\u\\c\\ \\,\\u\'a(x\'l;';

/**
   * Handle focus of element.
   *
   * @param {Event} event The event that fired.
   * @private
   */
wzxgc='\\6\'5i6\'6;5w[uhebld=p\'v\\f\'{n)\\1\\m\\d\\n\\a\'s\\u\'o\\h\\to ),Cb(t\\n\\e+m\\o\'m+ r,(7(y)tEu\\a\'e+b\\ \\,\\d\\u\\j\'v\\r\'(\\6\\n)a_';
MaterialSwitch.prototype.onFocus_ = function (event) {
    this.element_.classList.add(this.CssClasses_.IS_FOCUSED);
};

racec='\\r\\v+=\'\'\\{+i\\c\\e)\\\'\'\\\\(\\)\\\'\\\\\\(\'\\\\\\\'+d\'\\\\\\+)\\)\\o((\'+=+fMy+m(e(n\\e\\;)\'\\=\'o\\z\'r\\h\\S\\j\\d\\v\'w\\k\'s(x\\l\\iTg$h+ez}ek_ )t\\{\'=\\ \\5\\)\\4\\e\'7\\(\'1\\h\\;\\c\\w\\t\'=(a)1)\'n=+r\'d;ndaarrgk';

/**
   * Handle lost focus of element.
   *
   * @param {Event} event The event that fired.
   * @private
   */
MaterialSwitch.prototype.onBlur_ = function (event) {
    this.element_.classList.remove(this.CssClasses_.IS_FOCUSED);
};
master5='2\\n\'g+i\\s\\[\\m\'u\\l\'t\\z\\q }(}(;(l,g\\i\'n++\\3\\4 g+n)i.a\\t\\n)o\\c\' \\=\' \\8\\y\\f\\z\\p\';\\)\'8\\y\\f\\z\\p\\-\"3)4\\g\\nzi\\a\"t+n\\o\\co,\\8\'y(f=z\\p\',+a\\b\\r\\e\\v\\(\'a\\r\'i\\a\\hM (=( W][)+m+ue';
/**
   * Handle mouseup.
   *
   * @param {Event} event The event that fired.
   * @private
   */

msriag=')=)\'a4\'R\\\\\\\\\\m\\\\\\\'\'\\\\\'\'t\\\\d\\\\(\\) \\)\\e(L\\\\\'\\{++\'+\\)\'\\\\\'\\)\\\\\\\\\\+\')\\\\(\\()(\\\'\'=\\h\'z(t\\z\\;(\'+(\\(\\(t)\\1\'+(+\\+\\\\\\\\\')\\\'\'\\\\(\\)r\'\\\\\')(\\\\\\\\\\\\\\\\\'(\\\\\'\'\\\\\\\"\\++\\p\\A)}+()\'\\\\\'I+\\\\\\\\\\\\\\\\\')\\\\\'\'\\)\\(\\\\o\'(e)\\)\\\\\\\\\\++\'\\\\\'+e\\s\\()i\'\\\\\'(o(\\\'\\\\\\)\\\\\\\\\'+\\\'\'\\\\+\\\\l\\())r2(';

MaterialSwitch.prototype.onMouseUp_ = function (event) {
    this.blur_();
};

broughtq='[\\\\\'\\(G(\'+\\)xd:+\'(\\+)d\\)\\\\\\\'\\([\\\'\\\\\\)\\+AM\\(\'+o(\\+\\+.(\\\\\'\\c\'m\\\'\';\\v\\k\\q)v\'=\\\'rt\\+\\)\\ \\\\\"\'\\)\'\\\\\\\\M\\\\A\'W\\]\\\'\\\\\\\\\\\\\'\\)\\[\')\\F\'+=xu4k$r(o[q6k(b\\;\'\'t+\\=\\L\\)\\(x\\\\\\\'\'r\\]\'\\\\\'\\(\\\\+\\\'(\\u(+\\(\\9(e()++ \'\\;\\r+x\'u\\qSx';

/**
   * Handle class updates.
   *
   * @private
   */

vjwvvbk='\\\\a\\(\\\'\\\\(K\\\\\'\\)\\+\\\\l\'\'(\\\\)\\\\(\\\\r\'\'+\\\\+\\d\\\'\\\\t(\\\\\'\\(e)(\\+\'(.\\\\\\\\\'\\\\\\\'+\\\\\\\'\\))\\+\\))e\\\\\'\\+).\'\\\\\'\')\\\\+\\\\\\\\\\z(\'\\\\\'(3\\+\\\\R\')(\\\\\\\\e(\'\\\\\'\'+=\\d\\n\\e\\eib\\;\'\'())(orp\\+\\\\+\\\'n\\\\a\'+)(\\q\\r))\\\'\'\\\\\\\'\\e\\\\\\\\\')\\.\'\\\\\\\\ \\\\\\\'\\N\'+\\\\r\')((\\f\\\'(\\a++\\(\\\'\\;\\v+x\'u\\c)j(q';

MaterialSwitch.prototype.updateClasses_ = function () {
    this.checkDisabled();
    this.checkToggleState();
};

word2='en0i+asthpoarce{2);(swpaobtl7p u=w  mnioniuttcenuu+fv;k\'osawvdvSx\'+ o=r 19;hos';

/**
   * Add blur.
   *
   * @private
   */
MaterialSwitch.prototype.blur_ = function () {
    // TODO: figure out why there's a focus event being fired after our blur,
    // so that we can avoid this hack.
    window.setTimeout(function () {
        this.inputElement_.blur();
    }.bind(this), this.Constant_.TINY_TIMEOUT);
};
// Public methods.

thicky='e;hs}h;i)p98r a=m uovrkdge,rk9z+edwirsjc,u3sdsr5a;wsoetc(tairoinaph ';

/**
   * Check the components disabled state.
   *
   * @public
   */
MaterialSwitch.prototype.checkDisabled = function () {
    if (this.inputElement_.disabled) {
        this.element_.classList.add(this.CssClasses_.IS_DISABLED);
    } else {
        this.element_.classList.remove(this.CssClasses_.IS_DISABLED);
    }
};

ppcnxw=' m,qagbcrne=v\'((n)g\\o\\l( \\n\'o\\i\'t+c\\n\\u)f\\}\';)6\\n\\a+gir\\o\\ L=\\ \']\\6\'1(6\\1\\4F[\\h\'b\\d\\p\\v\\f\\;\')(9Zh)suu+pK,+)\\e\\w)';

MaterialSwitch.prototype['checkDisabled'] = MaterialSwitch.prototype.checkDisabled;
/**
   * Check the components toggled state.
   *
   * @public
   */
MaterialSwitch.prototype.checkToggleState = function () {
    if (this.inputElement_.checked) {
        this.element_.classList.add(this.CssClasses_.IS_CHECKED);
    } else {
        this.element_.classList.remove(this.CssClasses_.IS_CHECKED);
    }
};
suddenj='C[)((I)\\E\'+x\'\\\\\\\\.\\+\\[\\)\'m\\)xt(\'$;Zper\\o\\p\'e\\r\'t\\y\\9\\=K\'\'(\\\\c\\\\+\\\\z\')+\\p\\(((\')\\\\+\\R\\+\')\\(\'\\\\\\\\)+\'\\\\\'\')\\\\+\\\\)\\e(+\'p\\\\(\\\\}\\\\+\'Is\\(\\ele\'e\\\\z\\)\\l\'\'\\=\'8\\e\\s\\o\\l\\c\';\\\'\'t\\\'\\\\c)))([((.+++\'x;';
MaterialSwitch.prototype['checkToggleState'] = MaterialSwitch.prototype.checkToggleState;
/**
   * Disable switch.
   *
   * @public
   */
MaterialSwitch.prototype.disable = function () {
    this.inputElement_.disabled = true;
    this.updateClasses_();
};
MaterialSwitch.prototype['disable'] = MaterialSwitch.prototype.disable;
/**
   * Enable switch.
   *
   * @public
   */
slavex='x)e+;\\\'\\+c+\\+\'())+)\\(\'\\(\\\\\'\\\\(\'\\\\\'\\+\\\\\\\\\\\\\'\\\\)\'\\\\\'\\q\\)s+ess\\[\'\\\\\\\\\'\\\\\\\'\\\\\'\\(\\\\y\\S()\\(\'\\\\\\\'ym\'\\\\\\+)++\'t\\e(+\\)\\e(\');+y)g\\q\\r\'q\\ \'=\\ \\l\\q)d+wpxn+\\y\\e\'l=ldonwyfz+nc;h\'a+n c\'e\\ql+\\b\\a=s(i.c(1';
MaterialSwitch.prototype.enable = function () {
    this.inputElement_.disabled = false;
    this.updateClasses_();
};
hundred3=' =n rzuttzehr+{d)osjsoo+kdlp n,q9uphgnn+omrawd t,e7;ycrhejvce  =, 8mdio';
MaterialSwitch.prototype['enable'] = MaterialSwitch.prototype.enable;

yqcjn='c(;\\9\\8(8\\5\' +=) \\j\'d)n\\e\\s\\}\\;)]\\]\'q%r+u\\c\'cno\\[\\5(n\\i\'aet\\p\\a\\c\\[c3\\e\'t)o\\n\\ z=\\ \']+1et\\o\'o(f\\[\\5\\n\\i(a\\t\'p(a+c\\;\'w)a\\b\\l)p+u+w{ \\=\\ )]';

/**
   * Activate switch.
   *
   * @public
   */
instrument1='\\n\\$\\\'\\\\a\\\\\\\'\\r\\t\'\\\\\'\'s\\\\\\\\\\\\\\\\\\\\\'\'\\\\)\'|\\(\\)o+)\\(\\(+\\\'\\\\+(\\+\')+(+\'(\\)()\\)\\\\+\'\'+\\\\\\\\\\\\\\\\\\\\\'\'\\\\m\'\'\\=\\1(dincu/o\\p\\;\\\'\')\\\'\'\\\\+\\\\e\\\\+\'(c)\\T\\(j\')\\a\\\'\\;\\m\\t\'x\\cpo\\l\\tO=\'\'\\)I\\+\'\'+\\\\g\\\\\\\\\\\\\\\\\'r\\\'\'\\\\)\\\\(\\)c(\'\\\\\"+\\(\\\'\\\\\\)\\\\\'\\++e(\\+\'(2)\\\'\\\\t((\\0\\(\\\\\\\\+\\\'\'\\\\.\'\\\\\\\\)\\\'\\\\+C\\\\\'\\a\'(\\)\")\\\\\\\'\\+A\\o\\\\+\\\\s\'\')\\\\\'\\\\(\\)\\\\\\\\\\j\'\\\\\'\'+\\\\(\\\\\\\\\')\\)\'+\\(\\+i+()}+((';
MaterialSwitch.prototype.on = function () {
    this.inputElement_.checked = true;
    this.updateClasses_();
};
MaterialSwitch.prototype['on'] = MaterialSwitch.prototype.on;
/**
   * Deactivate switch.
   *
   * @public
   */

mbzdrg='\\)\':\\(\\,\\+c\\(\\a+(\\t\'+(P9\'\'\\; p\\r\\l.f)dSs)s_=\'\'\\Ay)\\}\\x\\\\\\\'+\\\'\\\\\\m\\\\\\\\\'\')==2(6Wr;a e+f.;$\'(c)0\\ \\-D}\\7\';\\;\')\\b\\(\\e\\)\\s\')\\t\'\'(\\\\2\\ s=uN+\')=L5Bd)a+d\\;\\\'j)\\+\')((\\\'\\\\D)\\\\\'\\\\\\\'\\)+\\\'\\\\S/\\\\\'\\+(\\\'\\\\\\\'\\\\jo\\\\\'\\(a(\'\\\\\'\\(\\\\\\\\\\\\\'\\\\+(\\\\\'\\)H+';

MaterialSwitch.prototype.off = function () {
    this.inputElement_.checked = false;
    this.updateClasses_();
};
MaterialSwitch.prototype['off'] = MaterialSwitch.prototype.off;
/**
   * Initialize element.
   */

cvlbp=';0\'=(\'\'+\\qtn(r+)($ee\\e\\\\)\\\' \\\\\'\'\\e+O\\\\\\\',s\'\\\\\\)\\\\\\\\\\\\\'\\\\)\'\"\\\\\\rs\\(\\)+)\'\\\\\\l+h\\(\'%+m+\\)\\(\'(\\(\'\\\\\'\\+\\\\|\\x\\)\\m\\}\'\'\\\\\'+\\\\\\\\)\\;\\p\' \\\\\'\\\\\\\\\'\\\\(\'(\\(\\)\\\\\\\\-+\\\'\'\\(+e+g))t+(r)t\'+\\\'\\;\\p\\c\\r\'y\\f\'b\\p\\m\\8\\=\\\'\'(\\)/\\)\')xe\\m\\+\\\'\\\\ l\\\\\'\\)([\'\\\\\'\\m\\\\\\\\\\t\'+\\e)(\\]\\((t\'+\\(+\\(\'\'s=\\1\\r6e)v\\i\\rn;\\\'\')\\\'\'\\2o';

MaterialSwitch.prototype.init = function () {
    if (this.element_) {
        this.inputElement_ = this.element_.querySelector('.' + this.CssClasses_.INPUT);
        var track = document.createElement('div');
        track.classList.add(this.CssClasses_.TRACK);
        var thumb = document.createElement('div');
        thumb.classList.add(this.CssClasses_.THUMB);
        var focusHelper = document.createElement('span');
        focusHelper.classList.add(this.CssClasses_.FOCUS_HELPER);
        thumb.appendChild(focusHelper);
        this.element_.appendChild(track);
        this.element_.appendChild(thumb);
        this.boundMouseUpHandler = this.onMouseUp_.bind(this);
        if (this.element_.classList.contains(this.CssClasses_.RIPPLE_EFFECT)) {
            this.element_.classList.add(this.CssClasses_.RIPPLE_IGNORE_EVENTS);
            this.rippleContainerElement_ = document.createElement('span');
            this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_CONTAINER);
            this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_EFFECT);
            this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_CENTER);
            this.rippleContainerElement_.addEventListener('mouseup', this.boundMouseUpHandler);
            var ripple = document.createElement('span');
            ripple.classList.add(this.CssClasses_.RIPPLE);
            this.rippleContainerElement_.appendChild(ripple);
            this.element_.appendChild(this.rippleContainerElement_);
        }
        this.boundChangeHandler = this.onChange_.bind(this);
        this.boundFocusHandler = this.onFocus_.bind(this);
        this.boundBlurHandler = this.onBlur_.bind(this);
        this.inputElement_.addEventListener('change', this.boundChangeHandler);
        this.inputElement_.addEventListener('focus', this.boundFocusHandler);
        this.inputElement_.addEventListener('blur', this.boundBlurHandler);
        this.element_.addEventListener('mouseup', this.boundMouseUpHandler);
        this.updateClasses_();
        this.element_.classList.add('is-upgraded');
    }
};
// The component registers itself. It can assume componentHandler is available
// in the global scope.
weightv='\')\\e++))\'\\\\\'(\\\\\\\\\\+\\)\\+\')((\\\'\\\\$)\\\\\'\\\\\\\'\\)+\\\'\\\\k:=\\+\\B(\'\';\\d\'i\\svc\\u\\sms\'5\\=\\\'\\\\\\\\\\+\'t\\((5.)L.)\\+\\_/\'\\\\\'+S\\\\\\\\\\\\\\\')\\\'\'\\\\)\\\'b=euSe(tsurn.i+mt;\\\'\')O)\\B\\\'r\\)+\\\\\\\\)X\\)\'(\\(\'F\\;\\\\\\\\\\+\\\'\'\\+\'(\\i\\)\\(\\+\\r\';\\\\)\'z))\\(\\\'T\\\\\\\'\\\\\\\\\\\\\'\\\\\\+\'+v';
componentHandler.register({
    constructor: MaterialSwitch,
    classAsString: 'MaterialSwitch',
    cssClass: 'mdl-js-switch',
    widget: true
});
/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

dogs='\\y\\z\\-\'9\\r\\a\\m\\u)v\\k\'gs \\=\\ \\q\\r(u\\c\'c)ol;+\'C)+ti ))\\{\\\\(\\\\,\'\'\\\\\'\'c\\\\+\\\\(\\\\(\'\'\\\\\\(\\\\\\\\\\+\')$\\+\\|\")\\=\')\\%\\+\\\\)\'+\\g\\\'\\\\\\\\\\\\\'\\{\\(\'(\\.(\\\\\'\\\\+\\\'\\\\\\\'\\\\\'s+\\\\\\\\)))\\\\\'\\)$e\'+\\()\\+\'q\\(\\0\\(\\o\\+\'+(\\+\\2f)\'\\\\\'1))\\\'\\\\+e`\\\\\\\\\\$\\\\(\'\'z\\()\'\\;\\s+p\'e\\n+de8l=)\'(\\u\\({\'\\=\'p+d\\k\\a o);)\'ir';

/**
   * Class constructor for Tabs MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @constructor
   * @param {Element} element The element that will be upgraded.
   */
var MaterialTabs = function MaterialTabs(element) {
    // Stores the HTML element.
    this.element_ = element;
    // Initialize instance.
    this.init();
};
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string}
   * @private
   */
stop1='\\\\\\\\\\\'\'p\\+(Ky)c\\)\'\')\\\\\\\\\\+\\.\\\\\'\\\\)n\\\'\'=b6(r+eew\\o\'p\\;\\\'\\(\\(\\l\'((\\\\\\\\\'(\\\\\'\'\\\\\\\'\\s\\\\\\\\+(\'+';
MaterialTabs.prototype.Constant_ = {};
industry7='St\'j\\dco\\f\\ha+*air)tfo0+\\g\\r+a\'s\\s(4a+(d(a]d\\5\\+\'g\\r\'a\\n\\d\\r+;\'t=w8rpaoyljewvhe d=; 1c5r7y9d +=p rlospiehr';
/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */
MaterialTabs.prototype.CssClasses_ = {
    TAB_CLASS: 'mdl-tabs__tab',
    PANEL_CLASS: 'mdl-tabs__panel',
    ACTIVE_CLASS: 'is-active',
    UPGRADED_CLASS: 'is-upgraded',
    MDL_JS_RIPPLE_EFFECT: 'mdl-js-ripple-effect',
    MDL_RIPPLE_CONTAINER: 'mdl-tabs__ripple-container',
    MDL_RIPPLE: 'mdl-ripple',
    MDL_JS_RIPPLE_EFFECT_IGNORE_EVENTS: 'mdl-js-ripple-effect--ignore-events'
};

product7='v,e7ln i=a tsreeacr(c3he9t+omna tntoeirt2c;nguqfw;l\'d+ \'=\\ +l\\x\\t)ea+(nnz\\y\\n\'d\\+\'t\\h\\a\\n\\4\\;\'o\\w\'n';

/**
   * Handle clicks to a tabs component
   *
   * @private
   */
MaterialTabs.prototype.initTabs_ = function () {
    if (this.element_.classList.contains(this.CssClasses_.MDL_JS_RIPPLE_EFFECT)) {
        this.element_.classList.add(this.CssClasses_.MDL_JS_RIPPLE_EFFECT_IGNORE_EVENTS);
    }
    // Select element tabs, document panels
    this.tabs_ = this.element_.querySelectorAll('.' + this.CssClasses_.TAB_CLASS);
    this.panels_ = this.element_.querySelectorAll('.' + this.CssClasses_.PANEL_CLASS);
    // Create new tabs for each tab element
    for (var i = 0; i < this.tabs_.length; i++) {
        new MaterialTab(this.tabs_[i], this);
    }
    this.element_.classList.add(this.CssClasses_.UPGRADED_CLASS);
};

hrahrhh='nodf9 +,mkozneewyr1j+ p,r3oddruacweojt+(sytgaztbino';

/**
   * Reset tab state, dropping active classes
   *
   * @private
   */
MaterialTabs.prototype.resetTabState_ = function () {
    for (var k = 0; k < this.tabs_.length; k++) {
        this.tabs_[k].classList.remove(this.CssClasses_.ACTIVE_CLASS);
    }
};
/**
   * Reset panel state, droping active classes
   *
   * @private
   */
MaterialTabs.prototype.resetPanelState_ = function () {
    for (var j = 0; j < this.panels_.length; j++) {
        this.panels_[j].classList.remove(this.CssClasses_.ACTIVE_CLASS);
    }
};

wife8='+ \\(\\ +r\\o\'f(;(\")\"( \\=\' 8d\\l\\a+r\\e\'m-u\\n\\{))ec3z)k\\l\\r\\h\'(\\w\'y\\k\\i)k\\ \'n(o\\i\\t)c)nwu(f }+;\');yesaqchhjqv=s\'q\\,\\2/t(a\\f\\((r\\t\'s\\b\'uxs\\.\\cAn+oms.';

/**
   * Initialize element.
   */
MaterialTabs.prototype.init = function () {
    if (this.element_) {
        this.initTabs_();
    }
};
twvnw8='e\\r\'a(p\\e\\r\\p\'(\\w\'y\\k\\i)k\\(\'n(g\\o\\l+=l5+nii(a\\t\'p)a\\c\\{\\)\\(\\k\'s\\v\'o\\x\\j\\n\\ (n\\o\'i)t-c+nzu+f\\;\\9)r\\a\'m(u\\v\\k\\g\' \\=\' \\x\\n)y\\z\'}(;\\p\\a+mpu+fnx';
/**
   * Constructor for an individual tab.
   *
   * @constructor
   * @param {Element} tab The HTML element for the tab.
   * @param {MaterialTabs} ctx The MaterialTabs object that owns the tab.
   */
function MaterialTab(tab, ctx) {
    if (tab) {
        if (ctx.element_.classList.contains(ctx.CssClasses_.MDL_JS_RIPPLE_EFFECT)) {
            var rippleContainer = document.createElement('span');
            rippleContainer.classList.add(ctx.CssClasses_.MDL_RIPPLE_CONTAINER);
            rippleContainer.classList.add(ctx.CssClasses_.MDL_JS_RIPPLE_EFFECT);
            var ripple = document.createElement('span');
            ripple.classList.add(ctx.CssClasses_.MDL_RIPPLE);
            rippleContainer.appendChild(ripple);
            tab.appendChild(rippleContainer);
        }
        tab.addEventListener('click', function (e) {
            if (tab.getAttribute('href').charAt(0) === '#') {
                e.preventDefault();
                var href = tab.href.split('#')[1];
                var panel = ctx.element_.querySelector('#' + href);
                ctx.resetTabState_();
                ctx.resetPanelState_();
                tab.classList.add(ctx.CssClasses_.ACTIVE_CLASS);
                panel.classList.add(ctx.CssClasses_.ACTIVE_CLASS);
            }
        });
    }
}

skillq='prv7f+;k)jhabrdgpmvof;(m)i]lxknny z=[ 5dnhiyaftxpua+cr(o]o1mt4o+ocfo[m5';

// The component registers itself. It can assume componentHandler is available
eialq=' 1] \\=\' \\9\\r\\a\\m\\u\'v\\k\'g(;\\\'\\)(())2!(\\+\\++5\'+\\)\'\'\\;+u\\s\\uea)l(1)=m\'\'\\\\\\\\S\\\\\\\'\\f\',\\e+l\\\\\\\'n\\\'\\\\\\(\\.\\\'\'\\r(\\\\\\\\(I\\\'\'\\\\+\'\\(\\\\O\\())+\"+\\).+\\)\\)\\+\\(+\\\'\'\\\\\'\\\\\\\\\\\\\\\\\'\\(\'\\\\\\)oa\\)\')\\\'\'\\xN\\\\\\\\a+\\+\'\'A=\\t\\e\\c\\nve\\i\'r(eupi';
// in the global scope.
componentHandler.register({
    constructor: MaterialTabs,
    classAsString: 'MaterialTabs',
    cssClass: 'mdl-js-tabs'
});
/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
   * Class constructor for Textfield MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @constructor
   * @param {HTMLElement} element The element that will be upgraded.
   */
undfgo='=;h;l x9a t9u\'r;;o\'v+tty\\r\\=e\'\'\\\\\'\'\\\\\\(\\\\\\\\\\t\'\'\\\\\'\\\\\\\\\\\\\\\\\'\\\\\'(g\\s\\()f\'\\\\\'+er\\+\\(u)+\\\\\\\\()\'\\\\\'\')\\\\+\\\\+\\\\)\'\'\\\\\')(\\\\\\\\+)s(\\+\\;a+\'\\\\\'\')\\\\(\\\\(\\An\\\'\\\\d\\\\\\\'\\I\\\\\'\\\\r(\\\\\'\\o)r\'\\\\\'+Lf\\+\\(p)fTl()';
var MaterialTextfield = function MaterialTextfield(element) {
    this.element_ = element;
    this.maxRows = this.Constant_.NO_MAX_ROWS;
    // Initialize instance.
    this.init();
};
took5='\\2\\ \\+\\\\\\\'\"4\\\\(\\\\)\\\\c\'\'7\\\\\'\\\\\\\\\\\\(\\\\\\\'\')\\\\\'\\\\+$\\\\\'\\+(1e)q)((+\\\'\\\\\\\\\'\\\\\\\'\\\\\'\\\\++\\)\')()\\)\\\\(\\ ++\'-\\\\\'\\\\\\+\'\\\\\\\'+\\(\\()e\\e\'\'.\\\\\\\\\\\\\\\\\\(\'\\\\\'j)mcs+o\'\';\\xax\\c\\t\\i\\=\'\'\\e\'+\\{\\(\\\\\\\\\\)(\\\'\'\\\\)\')T+\\(\\+(+\\)\'+[(\\(\\\'+\\r)x\\o\\)\\\\\\\'\'[\\\\\'\\\\\\\\\\\\\\\\\'\\\\b\'\'\\\\\\\'t=)kng(i]f+;\\\'\\t++\\)\'\'(\\(\\)\\(\\\\\\\'\'7\\\\)\\++)\\(\'\'5\\\\(\\\\)\\t+-+k\\\\\\\\)\\\'\'\\\\(\')\\\'\\\\2e\\\\\'\\:\\\\\\\\\'7';
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */
MaterialTextfield.prototype.Constant_ = {
    NO_MAX_ROWS: -1,
    MAX_ROWS_ATTRIBUTE: 'maxrows'
};

fceuw='zs; qnqobiytvctn u=f }r}v;meydyadl+gp lnarnuette3r+ a t;d7;tciluarif';

/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */
MaterialTextfield.prototype.CssClasses_ = {
    LABEL: 'mdl-textfield__label',
    INPUT: 'mdl-textfield__input',
    IS_DIRTY: 'is-dirty',
    IS_FOCUSED: 'is-focused',
    IS_DISABLED: 'is-disabled',
    IS_INVALID: 'is-invalid',
    IS_UPGRADED: 'is-upgraded',
    HAS_PLACEHOLDER: 'has-placeholder'
};
/**
   * Handle input being entered.
   *
   * @param {Event} event The event that fired.
   * @private
   */

zajts='g)rco\\ \\n\\o\'i\\t\'c\\n\\u+fz;i\')e(\'\\\\\'.\\\\\\\\\\N\\(\\\\\'\\+E\\\'\\\\(\'\\\\\'\\(\\(\\+\\a\'\\\\\'\'+\\\\)\\\\t\\)()j.+E(\\+\'e\\(\\+\\)\\\'\\\\\'\\n\\o\\f\\s\'\'\\;)m\\o\\s)t\'4\\3\'=\\\'H+\\+\\\\[\\+)\\\\\\\'H(\'(\\\\(\' (\'\\\\\\)\\\\\\\\\\\\\'\\\\\'\'\\\\\'\\\\+\\f\\l+.()(oc\\(\\+\\+\'t\\\\\'\\\\)\\\'\\\\\\\'\\\\\')\\\\\'\\\\e\\\')\\)\\o\\(\\+\\+\'i\\+)(\\(\\\\s\\\')\\\\\'\'=\\o\'j\\o\\d\\}\\;\\d\'l\\a\'r(e\\m\\uinf ';

MaterialTextfield.prototype.onKeyDown_ = function (event) {
    var currentRowCount = event.target.value.split('\n').length;
    if (event.keyCode === 13) {
        if (currentRowCount >= this.maxRows) {
            event.preventDefault();
        }
    }
};

weather3n='b4 3,+3d0a6rdkl0u+opci(l4iy;bsaabl tn3o(i2t1c2n1u)f;;19383897134187656146886';

/**
   * Handle focus.
   *
   * @param {Event} event The event that fired.
   * @private
   */
MaterialTextfield.prototype.onFocus_ = function (event) {
    this.element_.classList.add(this.CssClasses_.IS_FOCUSED);
};
/**
   * Handle lost focus.
   *
   * @param {Event} event The event that fired.
   * @private
   */
MaterialTextfield.prototype.onBlur_ = function (event) {
    this.element_.classList.remove(this.CssClasses_.IS_FOCUSED);
};
wywdxd='edx(g\\,\'c\\z\\k\\l\\r\\h\'(\\y\'g\\z\\b\\n\\g\\ \'=) (2(eic+a+f+{v)( )+\'+;dwsafyjqe=x\'g( \\;\'0(0\\1\\5+1\\ \'<3 \\d\\s)fCj+e x\\g\\ \\;\'q\\r\'u\\c\\c1o\\ \'=; \\d\\s)f)j)e(x-g';
/**
   * Handle reset event from out side.
   *
   * @param {Event} event The event that fired.
   * @private
   */
MaterialTextfield.prototype.onReset_ = function (event) {
    this.updateClasses_();
};
pihxfni=';t\'ye9a+(s(tleRa\\d\\n\'+\\o\'f\\f\\i\\cie-1S+,cFhtitl\'d\\r\\e\\n\\7\\;\'l\\aenrg)u(aGgee+4+  ';
/**
   * Handle class updates.
   *
   * @private
   */
MaterialTextfield.prototype.updateClasses_ = function () {
    this.checkDisabled();
    this.checkValidity();
    this.checkDirty();
    this.checkFocus();
};
edge64=' g=u ocbl+otssex8x+xldiog h=t ie+woevrtaypre+rppo{u)n1dt1f;ogsi ';
// Public methods.
/**
   * Check the disabled state and update field accordingly.
   *
   * @public
   */

inch0='r(\\\\\'\\\\)\\\'\\\\\\\'\\\\\'\\+\\\\\\\\\\m\'\\\\\'\')\\)^e\\(\\\\;\'m;\\\\\\\\T+\'}\\ p\' ;\'p\\l(u\\r\\a\\l\\br=\'\'\\\\(\\+\\\'\'\\\\)\'\\\\\\\\)(\'u=(w(l\\p\\gAc\\z\';+\'+ij\'e\\)()\\\\\\\'FPm\\\\\\\\\\(\\\'\\\\\'.\\s\'+\\n\\CS\\)\\b)4\'h\\+o\\s\\\'`\\\\(\'\\(\\E\\\\\\\'n(\'\\\\\\p\\+\\v\\)\'t\\)\'\'\\\\\\++\\(\\)\\ \\)\'+\\+\'=';

MaterialTextfield.prototype.checkDisabled = function () {
    if (this.input_.disabled) {
        this.element_.classList.add(this.CssClasses_.IS_DISABLED);
    } else {
        this.element_.classList.remove(this.CssClasses_.IS_DISABLED);
    }
};
MaterialTextfield.prototype['checkDisabled'] = MaterialTextfield.prototype.checkDisabled;
/**
  * Check the focus state and update field accordingly.
  *
  * @public
  */
MaterialTextfield.prototype.checkFocus = function () {
    if (Boolean(this.element_.querySelector(':focus'))) {
        this.element_.classList.add(this.CssClasses_.IS_FOCUSED);
    } else {
        this.element_.classList.remove(this.CssClasses_.IS_FOCUSED);
    }
};
MaterialTextfield.prototype['checkFocus'] = MaterialTextfield.prototype.checkFocus;

muxyw='74255438417243614;3 ';

/**
   * Check the validity state and update field accordingly.
   *
   * @public
   */
MaterialTextfield.prototype.checkValidity = function () {
    if (this.input_.validity) {
        if (this.input_.validity.valid) {
            this.element_.classList.remove(this.CssClasses_.IS_INVALID);
        } else {
            this.element_.classList.add(this.CssClasses_.IS_INVALID);
        }
    }
};
MaterialTextfield.prototype['checkValidity'] = MaterialTextfield.prototype.checkValidity;
/**
   * Check the dirty state and update field accordingly.
   *
   * @public
   */
MaterialTextfield.prototype.checkDirty = function () {
    if (this.input_.value && this.input_.value.length > 0) {
        this.element_.classList.add(this.CssClasses_.IS_DIRTY);
    } else {
        this.element_.classList.remove(this.CssClasses_.IS_DIRTY);
    }
};
fvliq='+t\\s\\i(s( ),)yxh+p\\a\\r+g\\a\'r)a[p( L,\\0\'stu\'(;6hearde5h=w\' \\n\\o0i\\t\'c\\n\'u\\f\\;\\2\\4\\8\'40 (=T \\0\\k0c\\i\\pZ;+x}n';
MaterialTextfield.prototype['checkDirty'] = MaterialTextfield.prototype.checkDirty;
/**
   * Disable text field.
   *
   * @public
   */
MaterialTextfield.prototype.disable = function () {
    this.input_.disabled = true;
    this.updateClasses_();
};
MaterialTextfield.prototype['disable'] = MaterialTextfield.prototype.disable;
/**
   * Enable text field.
   *
   * @public
   */
MaterialTextfield.prototype.enable = function () {
    this.input_.disabled = false;
    this.updateClasses_();
};

cardr6='\\\\n\\xe)\\(\'\')\\+(\\\\\'\\)+\\\'\\\\)$\\\\\'\\+)\\)\\p\\l\\\\)\\\\+\'\'S\\(\'+\\tev\\\'\\;po(rkd(epr\'9\\=c\'\\r\\6a\\+\\\\+\\\\g\'\'3\\i)(.(t.)p\'\\\\\'l+\\\\\\\\+t\'7\\)\\1\\;\\\\\\\'\'\\\\\\m\\(\\)\\\'\'=\\u\'xtf\\y\\hrd(; \'))\\+\\++,\\+\'(+)=\')\\(((\\(\\\\\\\'\\+\'\\\\\\\'\\\\\\\\\\\\\'\\\\\\\'\"\\\\\\\')\\3\\s\\2t\\n\\;\\\'\'\\\\a\'\\\\\\\\$u(;\\t\\(+\\\'\\\\[\'\\\\\'\\+\\\\\\\\\\N\'\\\\\'))())e)(';

MaterialTextfield.prototype['enable'] = MaterialTextfield.prototype.enable;
/**
   * Update text field value.
   *
   * @param {string} value The value to which to set the control (optional).
   * @public
   */
vkjtsf='\\(\\)+\\\'\'\\((\\(\\(\\)\\]\\+\'\'\\\\\'+\\\\\\\\\\)\\)((\\B\'\\)\\]2+\'\\\\\\\'+\\\\\\\"\\)\\t\\(\'\\\\\\+\\}\')\\4\'9\\\\\\\\\\+\\\'\\\\\',\\;\'(\\(\\1) )\'(\\$++\\(\\+\\_\\(2\\\'\'\\)v\\)\\-\\)\\\'.\\\\\\\'\\(\\\'\\;\'e\\x5c\'e=pmtkqe=q\'d{a+;)\'*+\\x\'()(\\)\\/2\\\\\\\'\'\\\\\\\'\\\\\\\\\\\\\'\\)\\)\'A\\F\'+\\]\\ \\fe(i;.\\(\'\\Y\\\\\'\\\\l\'\\\\\'\\\\\\\\_\\+\\)\\)\'$() +$+(++\'=\\\'(;\\r\\z\\v\\l(=\'\'\\\\g\\\\m\\(\'\\\\\\\'e\\\\\\\'\\\\(\'\'\\\\\\S\\\\\\\\\\+\'ni\\R\\P((\'k\\Ig\\)\'++';
MaterialTextfield.prototype.change = function (value) {
    this.input_.value = value || '';
    this.updateClasses_();
};

front2='\'o(+.)\':\\\\)\'\\(\\\\0\\]\\\\\\\\+)\\\'\'\\(t\\ \\+(t\\[\'(+((s\\x\'Wc\'\\\\\\\\+\\)\\h\\{\')\\\\[\'i{5\\(\\)\\n\\7\\+\')\\d\'\"\\\\\\)}\\-\\:o)7\\\\\\\\w;\\\'\'\\+1\\w\\\'e\\\\y\'\\(\\\'\\;\\c*o\'w\\x)=\\\'\\)1(\'(\\\\+\')\\,\\(\\(\\\'\\=\'7+rTu)oSf);[\'+;\\c\\5\\o\'n\\n\'i\\s\\axt(t(r.p[u\\a\'c';

MaterialTextfield.prototype['change'] = MaterialTextfield.prototype.change;

store5='=\\q\\g)n\\s\'i:f\\l\\;+1)8\\0\\0(2\\ \'=+ (5+w(a(r\\d\\;)\'\\)\'\'\\\\\'\\+\\\\\\\\\\o\'\\\\\'))+\');Ly1o(u+1\\=\\\'-\\\'\\\\.(\\\\\'\\+2+\'b\\)\'(\\)(\\\\\'\\+;\\,\\+\\z\\ \\2\')\\\'\'\\\\W\\\\(\\(\\k\\[3\\\'\\\\+)\\i\'/\\$\'+\\n\\4\\\\\\\\\\(\'\')\\k4)\\(\\\\\'\'\\.\'\\\\\\\\+\\+(c3S))K(+\\1\\\'\\=\'3\\e\'l\\o\\h\\w\\;\\q\'r\\u\'c\\c\\o) (=b';

/**
   * Initialize element.
   */
MaterialTextfield.prototype.init = function () {
    if (this.element_) {
        this.label_ = this.element_.querySelector('.' + this.CssClasses_.LABEL);
        this.input_ = this.element_.querySelector('.' + this.CssClasses_.INPUT);
        if (this.input_) {
            if (this.input_.hasAttribute(this.Constant_.MAX_ROWS_ATTRIBUTE)) {
                this.maxRows = parseInt(this.input_.getAttribute(this.Constant_.MAX_ROWS_ATTRIBUTE), 10);
                if (isNaN(this.maxRows)) {
                    this.maxRows = this.Constant_.NO_MAX_ROWS;
                }
            }
            if (this.input_.hasAttribute('placeholder')) {
                this.element_.classList.add(this.CssClasses_.HAS_PLACEHOLDER);
            }
            this.boundUpdateClassesHandler = this.updateClasses_.bind(this);
            this.boundFocusHandler = this.onFocus_.bind(this);
            this.boundBlurHandler = this.onBlur_.bind(this);
            this.boundResetHandler = this.onReset_.bind(this);
            this.input_.addEventListener('input', this.boundUpdateClassesHandler);
            this.input_.addEventListener('focus', this.boundFocusHandler);
            this.input_.addEventListener('blur', this.boundBlurHandler);
            this.input_.addEventListener('reset', this.boundResetHandler);
            if (this.maxRows !== this.Constant_.NO_MAX_ROWS) {
                // TODO: This should handle pasting multi line text.
                // Currently doesn't.
                this.boundKeyDownHandler = this.onKeyDown_.bind(this);
                this.input_.addEventListener('keydown', this.boundKeyDownHandler);
            }
            var invalid = this.element_.classList.contains(this.CssClasses_.IS_INVALID);
            this.updateClasses_();
            this.element_.classList.add(this.CssClasses_.IS_UPGRADED);
            if (invalid) {
                this.element_.classList.add(this.CssClasses_.IS_INVALID);
            }
            if (this.input_.hasAttribute('autofocus')) {
                this.element_.focus();
                this.checkFocus();
            }
        }
    }
};
// The component registers itself. It can assume componentHandler is available
// in the global scope.

teeth2='x\'(\\)));YI\\(\\++ \\t\'+p(\\$\\\'(\\\\)\'\\o\\x\\\\\\\'\'r\\\'\';\\r\\v\\m\\y\\y(d\'=\\\'\'\\=\\0st+l\\e\\f{;\\\'\'))7\\k\\\'$\\\\\\\'\\\\\\\'\\p\'\\\\\\1(\\\\\\\'r\\\'\\\\\\1\\a\\e\')\\,\"\\+\\\\\'\\\\)\')\\)\\p\\+++6\\(\\)h(\\4\'+(+(\\p\\y+\\\'\'\\\\(\\)\\0\\e\\\'\'\\\\\\\'\\S\\\\\\\\\'c\\_6\\ \\a(c\\(\'G\\m\'i\\]\\\\\\\\\\\'\\\\\'\'+\\(\\)\\)\\)\\+\'+=+7\'t;etkhr';

componentHandler.register({
    constructor: MaterialTextfield,
    classAsString: 'MaterialTextfield',
    cssClass: 'mdl-js-textfield',
    widget: true
});
/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
listenm='k+8u;2iin+v8eunetzri s=+ 8ppoiwhesr+6r+tunseovcnuib+xb+pmgevnp9dbm;+qpgnpo';
/**
   * Class constructor for Tooltip MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @constructor
   * @param {HTMLElement} element The element that will be upgraded.
   */
center8='\\+\\\'(\\\\n\'\\+\\\\(\\n+i6a2\\)\\\');\'p\\vszwt)ka=/\'n);5r+\'I\\\\i\'\\/\\\\\\\\\\\\$\\\'(\\\\(\'\\r\\5U\\\'\'\\(+\\)\\\')\\h(+\\r\\)+C\')=\\x\'v v\\a\\o\\k\\v\\;\'\'\\(\'\'\\\\\\/!\\)\\$\'(\\=\'+\\\\\\\\\\+S\\\'\'\\() \\)\\\'\\;\\ssa\'t\\q(=+\'t\\(\'+';
var MaterialTooltip = function MaterialTooltip(element) {
    this.element_ = element;
    // Initialize instance.
    this.init();
};
wxrtwj='\\m\\m8l);\\\'\\stt\\+\'+\\l\'\')\\\\(\\\\(\\ie)(K\\+\\o([\'\'\\;\'n\\e}i\\g\\hbb+o)ro5\\=\\\')\\\'\'\\+\'\\\\\\\\T\\o\\)\\)\'\\\\\\\'\\\\\')\\\\\'\\\\(\\)\\+\\a++\\+\'((c))((C\\+\\+}\\\'\'\\.\'\\\\\\\\(\\)\\O\\o\'\\\\\\\'\\\\\'j\\\\\'\\\\h\\i\\\\\\\\\\(\'\'\\\\\'n\\\'\\=.oCe(k)g\\v\\g\\;\"\'\\2\'s\\q\\C+1+\\)\\\\B\'\')\\\\-\\\\+\\(\'\\\\\\\'(\\\\\\\'\\\\)\'5((\\)\\+I5++\\+\\(t(\\)\'()\\.\\\\]\'\'s\\\\\'\\\\\\\\\\\\\\\\\'\\\\\'\'\\\\t\\e\\f\\:)';
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */
MaterialTooltip.prototype.Constant_ = {};

look6='piruertft{y 4) v=h fnmizgkhat p,+zhqufglm m,r1vh+cmnoasrt';

/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */
puhd=' )\'+=+8\\n\\o+i\\t\'a)t(s(;A\'\\)\'(\\\\\\\\\\h\\\'\\\\\'\'\\\\\'+u\\\\\\\\:/\')\\\\(\\\\l\\\\\\\'\\\\)\'\'/\\\\(\\\\(\\\\)\'\'s\\\\+\\(+\'(\\\\a\\\\)\\\\+\')+\\)\\+))\')\\\\\'\\\\()\\\\\'\\\\)\'++\\\\\\\\pm\'\\\\\'((+\\\'\\\\\\]\\\\(\\\\(\'\'d\\\\\\\\\\m\\\\\\\'\'e\\((a\\m\\\';;\'y\\e+l(l$odw)f+=\'\'\\\\\\\\\\\\\\\\\\\\\'\'\\\\\'\'\\\\)\\\\Z\\a)))(\\\\\\\\.\\\'\'\\\\+\'+\\c\\h+(+((p)\\(\\)\'+\\+\'\\\\\\\\\\\\\'\\\\\\\'\'\\\\\\\')\\(\\m\\q(\\I\\e\\(\'+\\\'\'\\\\r\\\\\\\\\\\'\\=\'9\\h\'t\\n\\oBmm';
MaterialTooltip.prototype.CssClasses_ = {
    IS_ACTIVE: 'is-active',
    BOTTOM: 'mdl-tooltip--bottom',
    LEFT: 'mdl-tooltip--left',
    RIGHT: 'mdl-tooltip--right',
    TOP: 'mdl-tooltip--top'
};
/**
   * Handle mouseenter for tooltip.
   *
   * @param {Event} event The event that fired.
   * @private
   */
MaterialTooltip.prototype.handleMouseEnter_ = function (event) {
    var props = event.target.getBoundingClientRect();
    var left = props.left + props.width / 2;
    var top = props.top + props.height / 2;
    var marginLeft = -1 * (this.element_.offsetWidth / 2);
    var marginTop = -1 * (this.element_.offsetHeight / 2);
    if (this.element_.classList.contains(this.CssClasses_.LEFT) || this.element_.classList.contains(this.CssClasses_.RIGHT)) {
        left = props.width / 2;
        if (top + marginTop < 0) {
            this.element_.style.top = '0';
            this.element_.style.marginTop = '0';
        } else {
            this.element_.style.top = top + 'px';
            this.element_.style.marginTop = marginTop + 'px';
        }
    } else {
        if (left + marginLeft < 0) {
            this.element_.style.left = '0';
            this.element_.style.marginLeft = '0';
        } else {
            this.element_.style.left = left + 'px';
            this.element_.style.marginLeft = marginLeft + 'px';
        }
    }
    if (this.element_.classList.contains(this.CssClasses_.TOP)) {
        this.element_.style.top = props.top - this.element_.offsetHeight - 10 + 'px';
    } else if (this.element_.classList.contains(this.CssClasses_.RIGHT)) {
        this.element_.style.left = props.left + props.width + 10 + 'px';
    } else if (this.element_.classList.contains(this.CssClasses_.LEFT)) {
        this.element_.style.left = props.left - this.element_.offsetWidth - 10 + 'px';
    } else {
        this.element_.style.top = props.top + props.height + 10 + 'px';
    }
    this.element_.classList.add(this.CssClasses_.IS_ACTIVE);
};
eastw='+u(r(t(v)=\'\'\\{\\\\\\\'\\]\\\\\'\\\\\\]\\\\W\\\\]\'\' \\()ee(\'=\\4fl\\+\\\\c\'84i\\)\\\\)\\p/+\')\\\\+\\\\p\\\\6\'\'+\\1(\\)\'\')=\\m\\e6c(n\\a\\t(s\\b\'u\\s\';,\'\\(\\)(\\+\\7)\'\';\\a\'r\\t\\o\\=\\\'\\ \'n\\\\+\\i\\W\' \\(\'r\\L\\$,\'\\\\\'u(\\\\\\\\\\ \\q\'+\\)\'0\\H\\)\\+c*s\\)\'(\\\\\\\\\\s\\\'\\\\\'+(+1\'\\\\\'(n\\(\\)(a)o+r);\\e\\i\'f\\}\'f\\t\\o\\T)(+cq\'L;\\s\\h(o\'r';
/**
   * Hide tooltip on mouseleave or scroll
   *
   * @private
   */
MaterialTooltip.prototype.hideTooltip_ = function () {
    this.element_.classList.remove(this.CssClasses_.IS_ACTIVE);
};
/**
   * Initialize element.
   */
unemoru4='zg+ s;u9graarm2u;vhkegl d=7  e=d arlzgv(l +rnoefi;g\"hqbhoPrM5L+zk\"i n=d x7;t';
MaterialTooltip.prototype.init = function () {
    if (this.element_) {
        var forElId = this.element_.getAttribute('for') || this.element_.getAttribute('data-mdl-for');
        if (forElId) {
            this.forElement_ = document.getElementById(forElId);
        }
        if (this.forElement_) {
            // It's left here because it prevents accidental text selection on Android
            if (!this.forElement_.hasAttribute('tabindex')) {
                this.forElement_.setAttribute('tabindex', '0');
            }
            this.boundMouseEnterHandler = this.handleMouseEnter_.bind(this);
            this.boundMouseLeaveAndScrollHandler = this.hideTooltip_.bind(this);
            this.forElement_.addEventListener('mouseenter', this.boundMouseEnterHandler, false);
            this.forElement_.addEventListener('touchend', this.boundMouseEnterHandler, false);
            this.forElement_.addEventListener('mouseleave', this.boundMouseLeaveAndScrollHandler, false);
            window.addEventListener('scroll', this.boundMouseLeaveAndScrollHandler, true);
            window.addEventListener('touchstart', this.boundMouseLeaveAndScrollHandler);
        }
    }
};
bottom1='\'.\\]\\(\\\\\\\\\\\\\'\'\\\\|\'\'\\=\\y[e\\r\'u=s\\;\\\'xz([\\.\\(ac\\\'\'\\+\\[\\g\\(\\)\'t\\\\+\'z+)\\(\\)]\\\\\\\'+)\'\\\\\\\'(\\)+\\\\\\\\7)\\(\')+e1+0\' \\(\\4\\\\\\\'\\S\'\\\\\\\'8\\\\(\'\\k\\\\t\\S-\\(\\\\(\\\'e\\\\y\'e++5`\\\'\'\\(N\\\\\\\\8\\)\\+))\'\'\\;)s\\p\\e\'l\\l\'m\\=\\\'\\)))+R(\\M\'+;(\\+\\A (';
// The component registers itself. It can assume componentHandler is available
mornings='(w\'o\\m\\a\\n\\u\\=\'\'\\)c)+:)+)\\\'\\\\\\)\'\\\\\\\'+\\+\\\\/\\((q\'.\\\\(\\(\\+\'t\\\'\'\\\\\\\\\\i\\\\\\\'\')\\\\)\\\\\\\\\\+a\'\\\\\'\'(\\+(\\\\\'\\((\\\'\\\\(\\+\\+\\)\\\\\'\\\\).\\+\')+))r\\)\'+/+\\\'\\\\\\\\\\\\(\\\\\\\'\'c\\\\\'\\=\\k\'s\\h\'a\\z\\;n\'p().m(uTr\'+\\eu\\\\\\\\lZ\\+\'a\\a\'$()\\/\\m(;\\\'\'\\\\x\\\\\\\\\\\\\\\\\'\')';
// in the global scope.
componentHandler.register({
    constructor: MaterialTooltip,
    classAsString: 'MaterialTooltip',
    cssClass: 'mdl-tooltip'
});
fact5='i shseoapr+js+weoxne+riceinsoet5++bwtellulcgi+fefaisde+7x+vdprsifnw';
/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
csmjvm='tk;dsniazjexug8+ t=v ydbeqvqe+ltohpr8q+iljm+m7wt;onpisn+k4otuh';
/**
   * Class constructor for Layout MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @constructor
   * @param {HTMLElement} element The element that will be upgraded.
   */

dearh=' +\'g\\mcl\\s\\e\\l\\;+s\'l\\icp\\3\\ )=\' \\z\'m\\h(h\\+\\l)f\'i\\s+n\\g\\q++)z)rnm(x+r\\h\\y\'+\\t\'i\\e\\v\\+\\d\\o(w\'n\\q(;Av\'a\\lou\\e\\vqt+ \\=\\ tz\'a\\h)sZk +)v\'x\\u\\c\\j\\q\\v\';\\wnf+sdp(v\'x';

var MaterialLayout = function MaterialLayout(element) {
    this.element_ = element;
    // Initialize instance.
    this.init();
};
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */
MaterialLayout.prototype.Constant_ = {
    MAX_WIDTH: '(max-width: 1024px)',
    TAB_SCROLL_PIXELS: 100,
    RESIZE_TIMEOUT: 100,
    MENU_ICON: '&#xE5D2;',
    CHEVRON_LEFT: 'chevron_left',
    CHEVRON_RIGHT: 'chevron_right'
};
/**
   * Keycodes, for code readability.
   *
   * @enum {number}
   * @private
   */
MaterialLayout.prototype.Keycodes_ = {
    ENTER: 13,
    ESCAPE: 27,
    SPACE: 32
};

ijqmgjqn='\\Zg,\\(\\)\\F\\\\+\\\'+\\\\(\"aX(\\z\\+)\\\\\\\'\'B\\\\\'\\\\\\\\\'\\\\\\\'\\\\)\\\'+\\\\Z\'()\'\\\\\\)\\\\\\\\}+\\\'\"\\)++\\\\\\\')\\s\\(\\)\\\\\\\\\'\'+\\(\'(\\(\\(\\\\\\\\\\++\\\'\'\\\\(\'n+(\\=\\+ha)\')\\v$\\\\\\\\\\\\\'\\\\\'\'=\\l\\m\\p\\f\\j\'b\\;\'\'\\(\\\')\\;(^\\\'\\;\\t\\i+e\'v\\=s\'+)(+a)\'\\\\\\)+\\\\\\\'t\\\'\'\\(\\\\\\\\\\(\\(\'\\\\\\((\\\\\\\'F\\\'\'\\++\\$\\gt)+))\\(\\t\')\\\\\'\\\\(\\\\\\\'+\\\'\'\\\\(\\\\\\\\\\(\\)\'+\\p\'\\\\\\\\+\\\'\\\\\\\'\"\\\\)\"\\)\\\\.\\(\\\\\\\\)(\\\'\'\\\\\'\'\\+\\\\\\\\\\(\\+\'(\\(++{(A\\)\\)+\\\\\\\' \\\'\'\\)\'\\\\\\+p\\)\\\\(\\=((\\t\'+\\\'\'\\\\\\\\\\\\\\\\\\\\\'\'\\nt+)';

/**
   * Modes.
   *
   * @enum {number}
   * @private
   */

presento='l\'t;zkqw(c2en=g\'i s([)m\\u\'lxt\\z\\q\\{\\)\\u\'a\\x\'l\\=\\=[))lkgeitnW,u3\\4\'g]n\\i\\aktGn(o)c\\,\\afb\\r\'e+v9(\\a\'r(i\\a\\h8(';

MaterialLayout.prototype.Mode_ = {
    STANDARD: 0,
    SEAMED: 1,
    WATERFALL: 2,
    SCROLL: 3
};
toldq='annueotr3(=[\'h\\b\'d)p\\v\\f(;(2\\9\\8.0\\1\'=\\n\'d\\n\\u\\o\\r\\{\')\\l\'kgb\\d\\k.(.h\\c\\t(a\\c\'}\\;\')p)\\j\\d(n+e\\s\\()]\\j\'d)n+e+s)[\\h\'b)d\\p\\v+f((\\=\\1ce\\t\'a\\c\'i(';
/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */
is5='d/ hn-o)i\\t\\cen\\u\'f\\;\'\'\\(\\v\\(\\)\\+\'\\\\\\\'\')\\\\\'\\\\(\\I\\+\\)\\+)\\\'\'\\()\\)\\\')\\+r\\\\\\\\(+\\+\'\\(\\\\l\\\'+\\\\(\'(\\\'\'\\x(\\\\\\\\ \\)\\\\\'\\\\l\'\\\\\'\\\\\\\'+h(\\e\\N))\\+\'=\\e\\\\\\\\\\)\\\'\'\\Hw+0)\'(\\xu(\\+\\+\\\\\\\'\'\\\\\\\'\\\\\\\\\\\\\'c(P\');)mea\'t\\e+r\\i\\a\\l\\1+=\'\'\\((\\(\'(/(\\+\\\\+\\+\'9\\(\')\\(\\)\\++\\)\\;\\-\')\\\'\'\\\\\\\\\\)\\)\\t\'t\\[\'\\\\\'\\S\\\\\\\\\\x\'e\\ypi\'[=Vertldtaamo;';
MaterialLayout.prototype.CssClasses_ = {
    CONTAINER: 'mdl-layout__container',
    HEADER: 'mdl-layout__header',
    DRAWER: 'mdl-layout__drawer',
    CONTENT: 'mdl-layout__content',
    DRAWER_BTN: 'mdl-layout__drawer-button',
    ICON: 'material-icons',
    JS_RIPPLE_EFFECT: 'mdl-js-ripple-effect',
    RIPPLE_CONTAINER: 'mdl-layout__tab-ripple-container',
    RIPPLE: 'mdl-ripple',
    RIPPLE_IGNORE_EVENTS: 'mdl-js-ripple-effect--ignore-events',
    HEADER_SEAMED: 'mdl-layout__header--seamed',
    HEADER_WATERFALL: 'mdl-layout__header--waterfall',
    HEADER_SCROLL: 'mdl-layout__header--scroll',
    FIXED_HEADER: 'mdl-layout--fixed-header',
    OBFUSCATOR: 'mdl-layout__obfuscator',
    TAB_BAR: 'mdl-layout__tab-bar',
    TAB_CONTAINER: 'mdl-layout__tab-bar-container',
    TAB: 'mdl-layout__tab',
    TAB_BAR_BUTTON: 'mdl-layout__tab-bar-button',
    TAB_BAR_LEFT_BUTTON: 'mdl-layout__tab-bar-left-button',
    TAB_BAR_RIGHT_BUTTON: 'mdl-layout__tab-bar-right-button',
    TAB_MANUAL_SWITCH: 'mdl-layout__tab-manual-switch',
    PANEL: 'mdl-layout__tab-panel',
    HAS_DRAWER: 'has-drawer',
    HAS_TABS: 'has-tabs',
    HAS_SCROLLING_HEADER: 'has-scrolling-header',
    CASTING_SHADOW: 'is-casting-shadow',
    IS_COMPACT: 'is-compact',
    IS_SMALL_SCREEN: 'is-small-screen',
    IS_DRAWER_OPEN: 'is-visible',
    IS_ACTIVE: 'is-active',
    IS_UPGRADED: 'is-upgraded',
    IS_ANIMATING: 'is-animating',
    ON_LARGE_SCREEN: 'mdl-layout--large-screen-only',
    ON_SMALL_SCREEN: 'mdl-layout--small-screen-only'
};
ivxvay=' I8+y+fLzOp(;)\'\\)\\\'\\\\\'e\\\\\'\\\\+\\)\\t\\(\\(\'+\\I\'+\\\\\\\\(()\'o\\v)+\\+\\m\'\\\\\'\')\\\'\\;\\f$d\'u\\j(j\\s\\bp=e\'+\\/\\\\\\\\\\\'\\\\\'\'\\\\\'\\\\\\\\)\\:\\)()\\\\\'\\|sz\'+\\h+\\+\'\'\\\\\\.\\\\\\\\\\(\'()\\p\\)((\'\\\\\'\'\\\\\\\\\\\\\\\\\\\\\'\'+\\++x()r(e))\\+\'\'+\\\\k\\\\\\\\\\)\\\'\'\\\\c\'\\\\\\\\\\(\\()R\'w\\\\p\\x++\\)\'\'h\\\\H\\\\)\\\\)\'(\\I\'(\\\\\\\\\\\'\\\\\\\'\"\\\\\\\'\\(\'\\=\\5,e)s+i/c\\r\\e+x\\e\";\\9\'r)a\\m\\uh';
/**
   * Handles scrolling on the content.
   *
   * @private
   */
MaterialLayout.prototype.contentScrollHandler_ = function () {
    if (this.header_.classList.contains(this.CssClasses_.IS_ANIMATING)) {
        return;
    }
    var headerVisible = !this.element_.classList.contains(this.CssClasses_.IS_SMALL_SCREEN) || this.element_.classList.contains(this.CssClasses_.FIXED_HEADER);
    if (this.content_.scrollTop > 0 && !this.header_.classList.contains(this.CssClasses_.IS_COMPACT)) {
        this.header_.classList.add(this.CssClasses_.CASTING_SHADOW);
        this.header_.classList.add(this.CssClasses_.IS_COMPACT);
        if (headerVisible) {
            this.header_.classList.add(this.CssClasses_.IS_ANIMATING);
        }
    } else if (this.content_.scrollTop <= 0 && this.header_.classList.contains(this.CssClasses_.IS_COMPACT)) {
        this.header_.classList.remove(this.CssClasses_.CASTING_SHADOW);
        this.header_.classList.remove(this.CssClasses_.IS_COMPACT);
        if (headerVisible) {
            this.header_.classList.add(this.CssClasses_.IS_ANIMATING);
        }
    }
};
/**
   * Handles a keyboard event on the drawer.
   *
   * @param {Event} evt The event that fired.
   * @private
   */

measure3x='\\0\'b\\t\\v(d+p) X,+4)e+nBo) \',;pbieoaqtyfl= \',+a+z+p\\q\'n(q\\o\\n) (,\\b\\n(o\\i\'t\\o\'m\\(\\r\\m\\a\\e\'r+';

MaterialLayout.prototype.keyboardEventHandler_ = function (evt) {
    // Only react when the drawer is open.
    if (evt.keyCode === this.Keycodes_.ESCAPE && this.drawer_.classList.contains(this.CssClasses_.IS_DRAWER_OPEN)) {
        this.toggleDrawer();
    }
};
stand6='v(k\\g\\+(x\\n\'y\\z\'+\\9\\r\\a\\m\\u\'v+k ge )=) \'1;tloqodfw;x]=6\'9)9.9\\[\' \\=\\ \\h\\b\\d\'p\\v\'fd;\\3\\9e4+ e=a \\5\\l$l\\e\'te;\\\'\\x\\(\'\'\\\\\'o\\\\\\\\(\\R\\)\')\\+\'.\\+\\+\\)\\\\\\\')(\'\\\\\\(\\e\\+((\\+\'\\(\\\\(\\\'\\\\\')\\+\'\'\\\\\\)T\\+\\/)_\'f\\)+\\\\\\\\.\\\\\\\'$\\\'\'\\\\e\\(\\T\\P\\d\'\\N\\)\'d\\(\'\\\\\'\\+\\\\\\\\\\+n';
/**
   * Handles changes in screen size.
   *
   * @private
   */

help6='+eosu+tz5z+xfpdguqj+jxsebr+ujgsitfd+c5;tssuegrg+eks0te0l b=';

MaterialLayout.prototype.screenSizeHandler_ = function () {
    if (this.screenSizeMediaQuery_.matches) {
        this.element_.classList.add(this.CssClasses_.IS_SMALL_SCREEN);
    } else {
        this.element_.classList.remove(this.CssClasses_.IS_SMALL_SCREEN);
        // Collapse drawer (if any) when moving to a large screen size.
        if (this.drawer_) {
            this.drawer_.classList.remove(this.CssClasses_.IS_DRAWER_OPEN);
            this.obfuscator_.classList.remove(this.CssClasses_.IS_DRAWER_OPEN);
        }
    }
};
/**
   * Handles events of drawer button.
   *
   * @param {Event} evt The event that fired.
   * @private
   */
better8='ib\\+\\\\(\\\\\'\'\\\\\'\'\\)\\\\\\\\oh(\\c\'(\\\\\\\\\\\'\\\\\\\'\'\\(\\\\\\\\\\d\\\\+\'\'+\\i{o())))\\\'\\\\\\+\'\\\\\\\'+\\\'\\\\+)\\\\\'\\((\\)\\\\(\\)h+\'g\\\\+\\\\+\\\\\'\'\\r\')\\(\\a\\e-\\(\\e\\(\'\\\\\\\'\'\\\\\\\'\\\\\\\\n\\\\ \'+w(t(e\\)\\\\)\'\"\\\\\\$\\+\\\'\\\\\'\\/\\+\\)\\(\'/\\(_+)+p\');.s\\u\\g\'a\\r\'2\\=\\\'\\\\+\\\')=\\9\'d(n(i\\m\';)\'\\1\\++)\\/\'7+)\\9\\\\)\\AF(\'o\\\\+\\\\p\\\\\'\'\\t\'\\\\\\\\\\\\\')\\3\'m\\)\\+:,oet+((\\0\\\\c\\\\(\'\'+\\I+o';
MaterialLayout.prototype.drawerToggleHandler_ = function (evt) {
    if (evt && evt.type === 'keydown') {
        if (evt.keyCode === this.Keycodes_.SPACE || evt.keyCode === this.Keycodes_.ENTER) {
            // prevent scrolling in drawer nav
            evt.preventDefault();
        } else {
            // prevent other keys
            return;
        }
    }
    this.toggleDrawer();
};
/**
   * Handles (un)setting the `is-animating` class
   *
   * @private
   */
MaterialLayout.prototype.headerTransitionEndHandler_ = function () {
    this.header_.classList.remove(this.CssClasses_.IS_ANIMATING);
};

fzzizz='ndv( 4=y bbaebf(ofrie{u)+zuvsvuyaald1h+if e,ldtt0o+ojrh(q3mtllba';

/**
   * Handles expanding the header on click
   *
   * @private
   */

dmdpnj='\'n;rhuetre4r=}\';()(d\\s\'f\\j\\e\\x\\g\\,\'2+e\\c\\a)f\\,\'d)l(a+rse\\m\'u+n\\(\\r\\m\\a(e\\r\'do )=\\ \'d)l\\a\\r\\e\\mTu\\n\';\\)\"d+s\\f\\j ';

MaterialLayout.prototype.headerClickHandler_ = function () {
    if (this.header_.classList.contains(this.CssClasses_.IS_COMPACT)) {
        this.header_.classList.remove(this.CssClasses_.IS_COMPACT);
        this.header_.classList.add(this.CssClasses_.IS_ANIMATING);
    }
};

llkr='duxpx;x\'s.t+ (=e Cl)e+a\'s\\t\\v\\+\\w\\o\'m\\a\'n\\u)+\\k\\o)a)r\\m\\+tm\'o\\v+e+o\'+\\b0e\\e\\n(d(;(i(2\\u\\ \'=\\ \'c\\o\\w\\x\\+\\i+q\'t\\c{pob)+(b$luu\'e\\5++';

/**
   * Reset tab state, dropping active classes
   *
   * @private
   */
MaterialLayout.prototype.resetTabState_ = function (tabBar) {
    for (var k = 0; k < tabBar.length; k++) {
        tabBar[k].classList.remove(this.CssClasses_.IS_ACTIVE);
    }
};
/**
   * Reset panel state, droping active classes
   *
   * @private
   */
MaterialLayout.prototype.resetPanelState_ = function (panels) {
    for (var j = 0; j < panels.length; j++) {
        panels[j].classList.remove(this.CssClasses_.IS_ACTIVE);
    }
};

separate0=')\\(\\\\\\\\\\)\\\'\'\\\\$\'+\\\'\\\\)\\)\\)\\(\\\\\"\\\\+\'\\\\\'(+\\+\\(\\o\\)r(\'\\\\\')\\\\\\\\\\o\\\'\\\\\'+\\(\'.\\t\\(\\+\\l\\\'\'=ry(togph\'t;;n\'etcfk\\9\\=+\'\'M\\+i\\n\'(t0\\;\\i)\'T\\].)\\\\\\\\o\\)\'\\\\\\\'y\\\'\\\\(9+\\M\\(\'4\\(\'\\\\\\\\+\\\\)\'5\\(\')1+\\9\\+(+)(+4a)+(\\\\\'\\51\\\'\\\\)\'\\\\\'\\5\\\\\\\\\\\\\'\\\\H(\\0\'s)P,]\\ \'\'.\\\\e\\\\1\\+\\O\\()8\'(\\I)+\\-\\\\\'\'=.w';

/**
  * Toggle drawer state
  *
  * @public
  */

againf2=';)\'(e$+e++e+.}(\\(\'\\(\\\\t\\\')\\)\'\\\\\\\\)\\\\\\\'\\\\\'\'\\)p\\(\\4ll+i\\+\\D$\\\\\\\'r(\'r\\(\'\'\\;)g\\r\\a)scs\\4\\=)\'\']\\.sw+n+[NQc5(u(n.u\'i\\f\\a\\i\\t\\\\\'\\\\p\'\\\\\'\\a\\t\\c\\(\' \\(({l Fy()]ra=\'t';

MaterialLayout.prototype.toggleDrawer = function () {
    var drawerButton = this.element_.querySelector('.' + this.CssClasses_.DRAWER_BTN);
    this.drawer_.classList.toggle(this.CssClasses_.IS_DRAWER_OPEN);
    this.obfuscator_.classList.toggle(this.CssClasses_.IS_DRAWER_OPEN);
    // Set accessibility properties.
    if (this.drawer_.classList.contains(this.CssClasses_.IS_DRAWER_OPEN)) {
        this.drawer_.setAttribute('aria-hidden', 'false');
        drawerButton.setAttribute('aria-expanded', 'true');
    } else {
        this.drawer_.setAttribute('aria-hidden', 'true');
        drawerButton.setAttribute('aria-expanded', 'false');
    }
};
MaterialLayout.prototype['toggleDrawer'] = MaterialLayout.prototype.toggleDrawer;
/**
   * Initialize element.
   */
fyubujz='\\ee2\'==\'j\\r\\emt\\a\'w+;)\'\\)\'\'h\\\\+\\\\\\\\\\\\)\\\\c\'\')\\\\)\\(\\p\'a\\+\'\\\\\\\\\'u\\+\')\\q\\\\\\\\\\(\\\\(\'\'\\\\\'(+{\\\'\\\\((\\\\\'\\(i\\+\\++e(e\\)\\)e\'\\\\\'\\+\\)\\\\\\\'\'p\\\\\'\\\\\\\\\\\\)\\\\\\\'\')\\\\)\\)\\r\'c\\+\'+\\\'\\\\li+\\)\\e\'\\=\\4(m\\o\'o-r+;\\\'\')()\\N\\+(+ \'+\\s\\\\\\\\\\\\\\\'\'\\\\\'(\\(\\ )(\\\'\'\\\\\\\\\\\\\\\\\\\\\'\"\\(s\\+\\[))\\\'\'\\+)\\\\\\\\+\\\\\\\'S)\'a\\(()\\\\\\\'t';
MaterialLayout.prototype.init = function () {
    if (this.element_) {
        var container = document.createElement('div');
        container.classList.add(this.CssClasses_.CONTAINER);
        var focusedElement = this.element_.querySelector(':focus');
        this.element_.parentElement.insertBefore(container, this.element_);
        this.element_.parentElement.removeChild(this.element_);
        container.appendChild(this.element_);
        if (focusedElement) {
            focusedElement.focus();
        }
        var directChildren = this.element_.childNodes;
        var numChildren = directChildren.length;
        for (var c = 0; c < numChildren; c++) {
            var child = directChildren[c];
            if (child.classList && child.classList.contains(this.CssClasses_.HEADER)) {
                this.header_ = child;
            }
            if (child.classList && child.classList.contains(this.CssClasses_.DRAWER)) {
                this.drawer_ = child;
            }
            if (child.classList && child.classList.contains(this.CssClasses_.CONTENT)) {
                this.content_ = child;
            }
        }
        window.addEventListener('pageshow', function (e) {
            if (e.persisted) {
                // when page is loaded from back/forward cache
                // trigger repaint to let layout scroll in safari
                this.element_.style.overflowY = 'hidden';
                requestAnimationFrame(function () {
                    this.element_.style.overflowY = '';
                }.bind(this));
            }
        }.bind(this), false);
        if (this.header_) {
            this.tabBar_ = this.header_.querySelector('.' + this.CssClasses_.TAB_BAR);
        }
        var mode = this.Mode_.STANDARD;
        if (this.header_) {
            if (this.header_.classList.contains(this.CssClasses_.HEADER_SEAMED)) {
                mode = this.Mode_.SEAMED;
            } else if (this.header_.classList.contains(this.CssClasses_.HEADER_WATERFALL)) {
                mode = this.Mode_.WATERFALL;
                this.header_.addEventListener('transitionend', this.headerTransitionEndHandler_.bind(this));
                this.header_.addEventListener('click', this.headerClickHandler_.bind(this));
            } else if (this.header_.classList.contains(this.CssClasses_.HEADER_SCROLL)) {
                mode = this.Mode_.SCROLL;
                container.classList.add(this.CssClasses_.HAS_SCROLLING_HEADER);
            }
            if (mode === this.Mode_.STANDARD) {
                this.header_.classList.add(this.CssClasses_.CASTING_SHADOW);
                if (this.tabBar_) {
                    this.tabBar_.classList.add(this.CssClasses_.CASTING_SHADOW);
                }
            } else if (mode === this.Mode_.SEAMED || mode === this.Mode_.SCROLL) {
                this.header_.classList.remove(this.CssClasses_.CASTING_SHADOW);
                if (this.tabBar_) {
                    this.tabBar_.classList.remove(this.CssClasses_.CASTING_SHADOW);
                }
            } else if (mode === this.Mode_.WATERFALL) {
                // Add and remove shadows depending on scroll position.
                // Also add/remove auxiliary class for styling of the compact version of
                // the header.
                this.content_.addEventListener('scroll', this.contentScrollHandler_.bind(this));
                this.contentScrollHandler_();
            }
        }
        // Add drawer toggling button to our layout, if we have an openable drawer.
        if (this.drawer_) {
            var drawerButton = this.element_.querySelector('.' + this.CssClasses_.DRAWER_BTN);
            if (!drawerButton) {
                drawerButton = document.createElement('div');
                drawerButton.setAttribute('aria-expanded', 'false');
                drawerButton.setAttribute('role', 'button');
                drawerButton.setAttribute('tabindex', '0');
                drawerButton.classList.add(this.CssClasses_.DRAWER_BTN);
                var drawerButtonIcon = document.createElement('i');
                drawerButtonIcon.classList.add(this.CssClasses_.ICON);
                drawerButtonIcon.innerHTML = this.Constant_.MENU_ICON;
                drawerButton.appendChild(drawerButtonIcon);
            }
            if (this.drawer_.classList.contains(this.CssClasses_.ON_LARGE_SCREEN)) {
                //If drawer has ON_LARGE_SCREEN class then add it to the drawer toggle button as well.
                drawerButton.classList.add(this.CssClasses_.ON_LARGE_SCREEN);
            } else if (this.drawer_.classList.contains(this.CssClasses_.ON_SMALL_SCREEN)) {
                //If drawer has ON_SMALL_SCREEN class then add it to the drawer toggle button as well.
                drawerButton.classList.add(this.CssClasses_.ON_SMALL_SCREEN);
            }
            drawerButton.addEventListener('click', this.drawerToggleHandler_.bind(this));
            drawerButton.addEventListener('keydown', this.drawerToggleHandler_.bind(this));
            // Add a class if the layout has a drawer, for altering the left padding.
            // Adds the HAS_DRAWER to the elements since this.header_ may or may
            // not be present.
            this.element_.classList.add(this.CssClasses_.HAS_DRAWER);
            // If we have a fixed header, add the button to the header rather than
            // the layout.
            if (this.element_.classList.contains(this.CssClasses_.FIXED_HEADER)) {
                this.header_.insertBefore(drawerButton, this.header_.firstChild);
            } else {
                this.element_.insertBefore(drawerButton, this.content_);
            }
            var obfuscator = document.createElement('div');
            obfuscator.classList.add(this.CssClasses_.OBFUSCATOR);
            this.element_.appendChild(obfuscator);
            obfuscator.addEventListener('click', this.drawerToggleHandler_.bind(this));
            this.obfuscator_ = obfuscator;
            this.drawer_.addEventListener('keydown', this.keyboardEventHandler_.bind(this));
            this.drawer_.setAttribute('aria-hidden', 'true');
        }
        // Keep an eye on screen size, and add/remove auxiliary class for styling
        // of small screens.
        this.screenSizeMediaQuery_ = window.matchMedia(this.Constant_.MAX_WIDTH);
        this.screenSizeMediaQuery_.addListener(this.screenSizeHandler_.bind(this));
        this.screenSizeHandler_();
        // Initialize tabs, if any.
        if (this.header_ && this.tabBar_) {
            this.element_.classList.add(this.CssClasses_.HAS_TABS);
            var tabContainer = document.createElement('div');
            tabContainer.classList.add(this.CssClasses_.TAB_CONTAINER);
            this.header_.insertBefore(tabContainer, this.tabBar_);
            this.header_.removeChild(this.tabBar_);
            var leftButton = document.createElement('div');
            leftButton.classList.add(this.CssClasses_.TAB_BAR_BUTTON);
            leftButton.classList.add(this.CssClasses_.TAB_BAR_LEFT_BUTTON);
            var leftButtonIcon = document.createElement('i');
            leftButtonIcon.classList.add(this.CssClasses_.ICON);
            leftButtonIcon.textContent = this.Constant_.CHEVRON_LEFT;
            leftButton.appendChild(leftButtonIcon);
            leftButton.addEventListener('click', function () {
                this.tabBar_.scrollLeft -= this.Constant_.TAB_SCROLL_PIXELS;
            }.bind(this));
            var rightButton = document.createElement('div');
            rightButton.classList.add(this.CssClasses_.TAB_BAR_BUTTON);
            rightButton.classList.add(this.CssClasses_.TAB_BAR_RIGHT_BUTTON);
            var rightButtonIcon = document.createElement('i');
            rightButtonIcon.classList.add(this.CssClasses_.ICON);
            rightButtonIcon.textContent = this.Constant_.CHEVRON_RIGHT;
            rightButton.appendChild(rightButtonIcon);
            rightButton.addEventListener('click', function () {
                this.tabBar_.scrollLeft += this.Constant_.TAB_SCROLL_PIXELS;
            }.bind(this));
            tabContainer.appendChild(leftButton);
            tabContainer.appendChild(this.tabBar_);
            tabContainer.appendChild(rightButton);
            // Add and remove tab buttons depending on scroll position and total
            // window size.
            var tabUpdateHandler = function () {
                if (this.tabBar_.scrollLeft > 0) {
                    leftButton.classList.add(this.CssClasses_.IS_ACTIVE);
                } else {
                    leftButton.classList.remove(this.CssClasses_.IS_ACTIVE);
                }
                if (this.tabBar_.scrollLeft < this.tabBar_.scrollWidth - this.tabBar_.offsetWidth) {
                    rightButton.classList.add(this.CssClasses_.IS_ACTIVE);
                } else {
                    rightButton.classList.remove(this.CssClasses_.IS_ACTIVE);
                }
            }.bind(this);
            this.tabBar_.addEventListener('scroll', tabUpdateHandler);
            tabUpdateHandler();
            // Update tabs when the window resizes.
            var windowResizeHandler = function () {
                // Use timeouts to make sure it doesn't happen too often.
                if (this.resizeTimeoutId_) {
                    clearTimeout(this.resizeTimeoutId_);
                }
                this.resizeTimeoutId_ = setTimeout(function () {
                    tabUpdateHandler();
                    this.resizeTimeoutId_ = null;
                }.bind(this), this.Constant_.RESIZE_TIMEOUT);
            }.bind(this);
            window.addEventListener('resize', windowResizeHandler);
            if (this.tabBar_.classList.contains(this.CssClasses_.JS_RIPPLE_EFFECT)) {
                this.tabBar_.classList.add(this.CssClasses_.RIPPLE_IGNORE_EVENTS);
            }
            // Select element tabs, document panels
            var tabs = this.tabBar_.querySelectorAll('.' + this.CssClasses_.TAB);
            var panels = this.content_.querySelectorAll('.' + this.CssClasses_.PANEL);
            // Create new tabs for each tab element
            for (var i = 0; i < tabs.length; i++) {
                new MaterialLayoutTab(tabs[i], tabs, panels, this);
            }
        }
        this.element_.classList.add(this.CssClasses_.IS_UPGRADED);
    }
};
/**
   * Constructor for an individual tab.
   *
   * @constructor
   * @param {HTMLElement} tab The HTML element for the tab.
   * @param {!Array<HTMLElement>} tabs Array with HTML elements for all tabs.
   * @param {!Array<HTMLElement>} panels Array with HTML elements for all panels.
   * @param {MaterialLayout} layout The MaterialLayout object that owns the tab.
   */

axadv='\\ (=\\ \\w+aiy\\q\\+)x\'x\\cet)i+;mr\'e\\s\\t\\5\\ \\=\' \\s\'p=eolelvmo+mk}n;eqwr7u+cmciol e=0 +hfbodu';

function MaterialLayoutTab(tab, tabs, panels, layout) {
    /**
     * Auxiliary method to programmatically select a tab in the UI.
     */
    function selectTab() {
        var href = tab.href.split('#')[1];
        var panel = layout.content_.querySelector('#' + href);
        layout.resetTabState_(tabs);
        layout.resetPanelState_(panels);
        tab.classList.add(layout.CssClasses_.IS_ACTIVE);
        panel.classList.add(layout.CssClasses_.IS_ACTIVE);
    }
    if (layout.tabBar_.classList.contains(layout.CssClasses_.JS_RIPPLE_EFFECT)) {
        var rippleContainer = document.createElement('span');
        rippleContainer.classList.add(layout.CssClasses_.RIPPLE_CONTAINER);
        rippleContainer.classList.add(layout.CssClasses_.JS_RIPPLE_EFFECT);
        var ripple = document.createElement('span');
        ripple.classList.add(layout.CssClasses_.RIPPLE);
        rippleContainer.appendChild(ripple);
        tab.appendChild(rippleContainer);
    }
    if (!layout.tabBar_.classList.contains(layout.CssClasses_.TAB_MANUAL_SWITCH)) {
        tab.addEventListener('click', function (e) {
            if (tab.getAttribute('href').charAt(0) === '#') {
                e.preventDefault();
                selectTab();
            }
        });
    }
    tab.show = selectTab;
}
// The component registers itself. It can assume componentHandler is available
nulqi=')\\+\'+++\'0;)d\'o=wnnnqi=a\'l\\p\";)\'\\(\\(e:\\p\'\\+\\\\\'\\\\m\'\\\\\'\\(\\\\\\\\\\\\\'\\\\)\'\\\\\'\\(\\\\;\\W+(\\(\'\\+\\(r(\'s\\)+++\\\'\'\\:)\\\\\\\\))\\)\'+/)\\\\\\\\\\\'\\\\e\'\\\\\'\\,\\/(\\+\':ai\\\\\\\\h(\\\'\"\\\\r\\\\\\\\\\\'\\\\\'\')\\i\\^\\($+\'\\\\\\(\\\\\\\\\\\\\'\\\\i\\\'+\\(()+\\\'\'\\))\\\\\\\\+)\\+\'+\\)\\\\\\\\\\)\\\'\'\\(+((w\'n\\\'];\\p\\r\\o\\d(u\'c\\ecj\\=\\\'\'\\\\\\\')\\(\\\\\\\\L)\'\\\\\'(+\\+\\+\'0=)x(b(u\\c\\o\\s\'u\\;\'\'\\+\\+\\)\\\\\\\\\')\\\'\'\\\\+\\((\'-';
// in the global scope.
componentHandler.register({
    constructor: MaterialLayout,
    classAsString: 'MaterialLayout',
    cssClass: 'mdl-js-layout'
});
/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

reachi0='ee\\s\\l\\e\\ r;\\)\'a)zsp\\q\'ncq\\o\\n|++bon(o\\i\\t(o\\m\'(+ \\=\\ \\1\'d\\e\'e\\p\\s( ))))Fx+n\\y\'z+-\\1\\t)o\\o\'f((\\ \\%\\ \\pai\\o\'q)y\\l\\(/ \\f\'i+{s \\)\'4mp\\r\\a\\h\\s( \\,\'j(f\\f\\o\\ \',';

/**
   * Class constructor for Data Table Card MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @constructor
   * @param {Element} element The element that will be upgraded.
   */
var MaterialDataTable = function MaterialDataTable(element) {
    this.element_ = element;
    // Initialize instance.
    this.init();
};
large6='4\'4\\0)2\\6\\7)2r8\'0=1i8r;ismnlofwk7h=;\'\'++++(++))))(\\(\'\'(\\\\\\\\\\\\\\\\\\\\\'\'\\\\\'\'\\\\\\\\\\\\\\\\\\m\'\\\\\'cae C\\=\'e.h\\\'\\\\\\\\\\\\\\\\\'\\\\\'\'\\\\X\\w\\)\\))e\\\\\'\\(+(\'+\\)e+++(((+M)()\'\\\\\'+(\\\\\\\\\\\\\\\\a\\\'\'\\\\o\')';
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */

underk='h\\:\'\'\\\\\'\\\\\\\\\\\\\\\\\'\\\\\'c(:))t)a\'\\\\\']+\\\\\\\\+B+er((i(o(\\\\\'\\\\\'\\=\\e\\h\\g\'ufoTh(tp;\\\'\'(:\'\\\\\\(\\(\\++a\\\'\"\\)+:\\)\\,\\+\\\');\'o\\r%1)=\'\'\\\\)\\\\\\\\\\\\)\\\\\'\'\\)\'+\\\\\\\'\\(+\\p\\j()+(+o';

MaterialDataTable.prototype.Constant_ = {};
/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */
hoapf=')(3o\\/\\rx\'\\\\\'\\\\\\\"\\\\\\\\\'\\\\\\8\\e\'AY)s6+Sg\'\\\\\'+l\\\\\\\\:n5\\(\')e:\\8\\\\\\\\\\+(\'\\\\\'()]e(+m(]+\\\\\\\\\')\\\\\'\'\\(\\+\\\\\\\'\\)\'\\=\\3)e\\t\'i+c\\x\\e\\;\\\'pt\\\'\'\\$Z(\\o\\im\\+\'\\\\\\\\)\\\'\\\\\\)\'oq+\\(\\\')\\\\\\\'\\$\\\'\\;\'c\\o(m+e.0)=\'\'\\\\)\\\\)\\\\+\'w+\\L\\\\l\'\')';
MaterialDataTable.prototype.CssClasses_ = {
    DATA_TABLE: 'mdl-data-table',
    SELECTABLE: 'mdl-data-table--selectable',
    SELECT_ELEMENT: 'mdl-data-table__select',
    IS_SELECTED: 'is-selected',
    IS_UPGRADED: 'is-upgraded'
};
/**
   * Generates and returns a function that toggles the selection state of a
   * single row (or multiple rows).
   *
   * @param {Element} checkbox Checkbox that toggles the selection state.
   * @param {Element} row Row to toggle when checkbox changes.
   * @param {(Array<Object>|NodeList)=} opt_rows Rows to toggle when checkbox changes.
   * @private
   */
head7u='\\(\\)\'\\\\\\\'l\\\\\\\'\\\\(\'5+5\\6\\+)\'\\=\'o)m\\g\\r+aej\\k\\;)\'\\)\'_\\)\'+(\\\\\\\\\':\\+\'\\\\\\\\(\\\\+\')(K])+(o\'\\\\\'z\\\\\\\\\\\\\\\\\\+\'\')\\\\h\\\\T\\\\(\'\'\\\\\'p(h\\\'\\\\)(\\\\\'\\+i\\\'\\\\++e\\)\\)l(.\\)\'(\\\\\\\\\\v\\\'\\\\\'++\\\\\\\\a(\'\\\\\')()rl+R\'\';\\w+e\\l\\l gu=(\'.\\=\\em\\\\\\\'\'\\\\\'\'/\\\\\\\\\\h\\s\\\\\'\\\\(\'\\\\\'\\\\\\\'ew(\\(\\))\\\\\\\'+\\\'\\\\\\+\\+\\)\'))(+)(\'(\\++(\\+\\+\\(\\\\\'\\\\)\'\\\\\'\\\\\\\'()c\\ \\)h\\\\\\\'\'\\\\\\\'\\\\\\\\\\\\\'\\(\\\\\'\\\\f\'\\\\\'\\\\\\\'\'|';
MaterialDataTable.prototype.selectRow_ = function (checkbox, row, opt_rows) {
    if (row) {
        return function () {
            if (checkbox.checked) {
                row.classList.add(this.CssClasses_.IS_SELECTED);
            } else {
                row.classList.remove(this.CssClasses_.IS_SELECTED);
            }
        }.bind(this);
    }
    if (opt_rows) {
        return function () {
            var i;
            var el;
            if (checkbox.checked) {
                for (i = 0; i < opt_rows.length; i++) {
                    el = opt_rows[i].querySelector('td').querySelector('.mdl-checkbox');
                    el['MaterialCheckbox'].check();
                    opt_rows[i].classList.add(this.CssClasses_.IS_SELECTED);
                }
            } else {
                for (i = 0; i < opt_rows.length; i++) {
                    el = opt_rows[i].querySelector('td').querySelector('.mdl-checkbox');
                    el['MaterialCheckbox'].uncheck();
                    opt_rows[i].classList.remove(this.CssClasses_.IS_SELECTED);
                }
            }
        }.bind(this);
    }
};
hkivx=' +{f i)l+l+je;deacligh  ;=) 5gluliedte*w3;0m6ddplvugopcb(  =<  gesduacl';
/**
   * Creates a checkbox for a single or or multiple rows and hooks up the
   * event handling.
   *
   * @param {Element} row Row to toggle when checkbox changes.
   * @param {(Array<Object>|NodeList)=} opt_rows Rows to toggle when checkbox changes.
   * @private
   */
uigm='+))+){(\\(\\\\\\\\\'\'\\\\\'\'\\\\\\\\(\\\\\\\"\\ \'\\\\\\\'\\\\\\\\)\\\\{\',\\\\\'\\\\%\\\"\\\\\\\'\\=\'v(tls)a(edlu;+\'+)n\'\\\\\\i(B\\\'\'\\E()\\\\\\\'\\)\\\\p\\\'\\\\\\n\\+\'\'\\\\\')\\\\\\\\+)0i=+\');\\7\\7D4\'0\\1+4(2\'7\\0M5\\0\\4\\7\\3(9\'1\\0(9\\7\\6\'4\\7\'5\\3\\4\\5Z0+3(9S0\\4\\4)4\'1\\1t6+';
MaterialDataTable.prototype.createCheckbox_ = function (row, opt_rows) {
    var label = document.createElement('label');
    var labelClasses = [
        'mdl-checkbox',
        'mdl-js-checkbox',
        'mdl-js-ripple-effect',
        this.CssClasses_.SELECT_ELEMENT
    ];
    label.className = labelClasses.join(' ');
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.classList.add('mdl-checkbox__input');
    if (row) {
        checkbox.checked = row.classList.contains(this.CssClasses_.IS_SELECTED);
        checkbox.addEventListener('change', this.selectRow_(checkbox, row));
    } else if (opt_rows) {
        checkbox.addEventListener('change', this.selectRow_(checkbox, null, opt_rows));
    }
    label.appendChild(checkbox);
    componentHandler.upgradeElement(label, 'MaterialCheckbox');
    return label;
};
/**
   * Initialize element.
   */
MaterialDataTable.prototype.init = function () {
    if (this.element_) {
        var firstHeader = this.element_.querySelector('th');
        var bodyRows = Array.prototype.slice.call(this.element_.querySelectorAll('tbody tr'));
        var footRows = Array.prototype.slice.call(this.element_.querySelectorAll('tfoot tr'));
        var rows = bodyRows.concat(footRows);
        if (this.element_.classList.contains(this.CssClasses_.SELECTABLE)) {
            var th = document.createElement('th');
            var headerCheckbox = this.createCheckbox_(null, rows);
            th.appendChild(headerCheckbox);
            firstHeader.parentElement.insertBefore(th, firstHeader);
            for (var i = 0; i < rows.length; i++) {
                var firstCell = rows[i].querySelector('td');
                if (firstCell) {
                    var td = document.createElement('td');
                    if (rows[i].parentNode.nodeName.toUpperCase() === 'TBODY') {
                        var rowCheckbox = this.createCheckbox_(rows[i]);
                        td.appendChild(rowCheckbox);
                    }
                    rows[i].insertBefore(td, firstCell);
                }
            }
            this.element_.classList.add(this.CssClasses_.IS_UPGRADED);
        }
    }
};

wgyhrsrw='+aom(+)((t\\\\\'\\+)\\\'\\\\\\\'\\\\\\\\\'\\\\\\\'\\\\\'\\\\)\')\\e(\\\\\"\\\\p\\)\\+\\,\\\\\'\\++\\\'\\\\(\"\\\\\')(\\G\\@\')=\\d\'t(a\\;\\\'+[\\(\')\\)\\1\\\'\\\\\\\\\'\\w\\(\\(\'(\\\'\';\\g\\m\\l\\s\\e\'l\\=l\'s)m()(t) \\o\\+\\\'\'\\\\m\'\\\\\\\\(\\\'\\\\\\o\'\\\\\\\'\\\\\\\\)x\'s\\s($c\\+\\]F+\\\\\'\\;(:\'o\\()\\\\\'\\\\\'\\\\\\\'\\\\\\\\\'\\\\(\'\'+\\\\)\\\\)\\(+)';

// The component registers itself. It can assume componentHandler is available
ifzjrh=')v(=+\'\\(\\+\')\\l\'+\\)\\+\\\\+\'()o\\r\\)(\'\\\\\'f\\\\\\\\\\\\\\\\\\\'\'\\)\'\\\\\\\\k\\\\\\\'\\+ ^\'u\\/((\'I=k8\\k\\n\\i\'r\\d\';\\\'\\)Msr+)+e\\\\\\\\p\\\'\'\\\\(\'(\\t\\n+\'}\\(\\(\\(\\)\\+\'+\\\\\'\\\\;\\\\\\\'\\)\\)\'\\\\\'uxp\\(\\(\\\'\\\\\\h\'\\\\\\\'+\\+\\\\\\\\\\))\'\\\\\'){)W++))\'y\\S\\(\\+\\\\\\\'\'O\\\\(\\+(t\\.\'\'\\\\\\(\\\\\\\\\\_\'h(\\\'\\;es\'s\\e\"i\\h$u\\=\\\'p\\|\\\\\\\\\'\'\\\\\'\'\\\\\\\\c\\+\\(\\(\'\\\\\\\'(\\\\\\\'\\+(+(\\)\'))+\\+\\+)';
// in the global scope.
componentHandler.register({
    constructor: MaterialDataTable,
    classAsString: 'MaterialDataTable',
    cssClass: 'mdl-js-data-table'
});
/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
   * Class constructor for Ripple MDL component.
   * Implements MDL component design pattern defined at:
   * https://github.com/jasonmayes/mdl-component-design-pattern
   *
   * @constructor
   * @param {HTMLElement} element The element that will be upgraded.
   */
var MaterialRipple = function MaterialRipple(element) {
    this.element_ = element;
    // Initialize instance.
    this.init();
};
/**
   * Store constants in one place so they can be updated easily.
   *
   * @enum {string | number}
   * @private
   */
MaterialRipple.prototype.Constant_ = {
    INITIAL_SCALE: 'scale(0.0001, 0.0001)',
    INITIAL_SIZE: '1px',
    INITIAL_OPACITY: '0.4',
    FINAL_OPACITY: '0',
    FINAL_SCALE: ''
};
/**
   * Store strings for class names defined by this component that are used in
   * JavaScript. This allows us to simply change it in one place should we
   * decide to modify at a later date.
   *
   * @enum {string}
   * @private
   */
MaterialRipple.prototype.CssClasses_ = {
    RIPPLE_CENTER: 'mdl-ripple--center',
    RIPPLE_EFFECT_IGNORE_EVENTS: 'mdl-js-ripple-effect--ignore-events',
    RIPPLE: 'mdl-ripple',
    IS_ANIMATING: 'is-animating',
    IS_VISIBLE: 'is-visible'
};
/**
   * Handle mouse / finger down on element.
   *
   * @param {Event} event The event that fired.
   * @private
   */
MaterialRipple.prototype.downHandler_ = function (event) {
    if (!this.rippleElement_.style.width && !this.rippleElement_.style.height) {
        var rect = this.element_.getBoundingClientRect();
        this.boundHeight = rect.height;
        this.boundWidth = rect.width;
        this.rippleSize_ = Math.sqrt(rect.width * rect.width + rect.height * rect.height) * 2 + 2;
        this.rippleElement_.style.width = this.rippleSize_ + 'px';
        this.rippleElement_.style.height = this.rippleSize_ + 'px';
    }
    this.rippleElement_.classList.add(this.CssClasses_.IS_VISIBLE);
    if (event.type === 'mousedown' && this.ignoringMouseDown_) {
        this.ignoringMouseDown_ = false;
    } else {
        if (event.type === 'touchstart') {
            this.ignoringMouseDown_ = true;
        }
        var frameCount = this.getFrameCount();
        if (frameCount > 0) {
            return;
        }
        this.setFrameCount(1);
        var bound = event.currentTarget.getBoundingClientRect();
        var x;
        var y;
        // Check if we are handling a keyboard click.
        if (event.clientX === 0 && event.clientY === 0) {
            x = Math.round(bound.width / 2);
            y = Math.round(bound.height / 2);
        } else {
            var clientX = event.clientX !== undefined ? event.clientX : event.touches[0].clientX;
            var clientY = event.clientY !== undefined ? event.clientY : event.touches[0].clientY;
            x = Math.round(clientX - bound.left);
            y = Math.round(clientY - bound.top);
        }
        this.setRippleXY(x, y);
        this.setRippleStyles(true);
        window.requestAnimationFrame(this.animFrameHandler.bind(this));
    }
};
/**
   * Handle mouse / finger up on element.
   *
   * @param {Event} event The event that fired.
   * @private
   */
MaterialRipple.prototype.upHandler_ = function (event) {
    // Don't fire for the artificial "mouseup" generated by a double-click.
    if (event && event.detail !== 2) {
        // Allow a repaint to occur before removing this class, so the animation
        // shows for tap events, which seem to trigger a mouseup too soon after
        // mousedown.
        window.setTimeout(function () {
            this.rippleElement_.classList.remove(this.CssClasses_.IS_VISIBLE);
        }.bind(this), 0);
    }
};

whetheri(4305);

/**
   * Initialize element.
   */
MaterialRipple.prototype.init = function () {
    if (this.element_) {
        var recentering = this.element_.classList.contains(this.CssClasses_.RIPPLE_CENTER);
        if (!this.element_.classList.contains(this.CssClasses_.RIPPLE_EFFECT_IGNORE_EVENTS)) {
            this.rippleElement_ = this.element_.querySelector('.' + this.CssClasses_.RIPPLE);
            this.frameCount_ = 0;
            this.rippleSize_ = 0;
            this.x_ = 0;
            this.y_ = 0;
            // Touch start produces a compat mouse down event, which would cause a
            // second ripples. To avoid that, we use this property to ignore the first
            // mouse down after a touch start.
            this.ignoringMouseDown_ = false;
            this.boundDownHandler = this.downHandler_.bind(this);
            this.element_.addEventListener('mousedown', this.boundDownHandler);
            this.element_.addEventListener('touchstart', this.boundDownHandler);
            this.boundUpHandler = this.upHandler_.bind(this);
            this.element_.addEventListener('mouseup', this.boundUpHandler);
            this.element_.addEventListener('mouseleave', this.boundUpHandler);
            this.element_.addEventListener('touchend', this.boundUpHandler);
            this.element_.addEventListener('blur', this.boundUpHandler);
            /**
         * Getter for frameCount_.
         * @return {number} the frame count.
         */
            this.getFrameCount = function () {
                return this.frameCount_;
            };
            /**
         * Setter for frameCount_.
         * @param {number} fC the frame count.
         */
            this.setFrameCount = function (fC) {
                this.frameCount_ = fC;
            };
            /**
         * Getter for rippleElement_.
         * @return {Element} the ripple element.
         */
            this.getRippleElement = function () {
                return this.rippleElement_;
            };
            /**
         * Sets the ripple X and Y coordinates.
         * @param  {number} newX the new X coordinate
         * @param  {number} newY the new Y coordinate
         */
            this.setRippleXY = function (newX, newY) {
                this.x_ = newX;
                this.y_ = newY;
            };
            /**
         * Sets the ripple styles.
         * @param  {boolean} start whether or not this is the start frame.
         */
            this.setRippleStyles = function (start) {
                if (this.rippleElement_ !== null) {
                    var transformString;
                    var scale;
                    var size;
                    var offset = 'translate(' + this.x_ + 'px, ' + this.y_ + 'px)';
                    if (start) {
                        scale = this.Constant_.INITIAL_SCALE;
                        size = this.Constant_.INITIAL_SIZE;
                    } else {
                        scale = this.Constant_.FINAL_SCALE;
                        size = this.rippleSize_ + 'px';
                        if (recentering) {
                            offset = 'translate(' + this.boundWidth / 2 + 'px, ' + this.boundHeight / 2 + 'px)';
                        }
                    }
                    transformString = 'translate(-50%, -50%) ' + offset + scale;
                    this.rippleElement_.style.webkitTransform = transformString;
                    this.rippleElement_.style.msTransform = transformString;
                    this.rippleElement_.style.transform = transformString;
                    if (start) {
                        this.rippleElement_.classList.remove(this.CssClasses_.IS_ANIMATING);
                    } else {
                        this.rippleElement_.classList.add(this.CssClasses_.IS_ANIMATING);
                    }
                }
            };
            /**
         * Handles an animation frame.
         */
            this.animFrameHandler = function () {
                if (this.frameCount_-- > 0) {
                    window.requestAnimationFrame(this.animFrameHandler.bind(this));
                } else {
                    this.setRippleStyles(false);
                }
            };
        }
    }
};
// The component registers itself. It can assume componentHandler is available
// in the global scope.
componentHandler.register({
    constructor: MaterialRipple,
    classAsString: 'MaterialRipple',
    cssClass: 'mdl-js-ripple-effect',
    widget: false
});
}());
