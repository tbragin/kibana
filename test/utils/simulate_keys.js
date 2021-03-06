define(function (require) {
  var $ = require('jquery');
  var _ = require('lodash');
  var Promise = require('bluebird');
  var keyMap = require('utils/key_map');
  var reverseKeyMap = _.mapValues(_.invert(keyMap), _.limit(_.parseInt, 1));
  var KeyboardEvent = window.KeyboardEvent;

  /**
   * Simulate keyboard events in an element. This allows testing the way that
   * elements respond to keyboard input.
   *
   * # sequence style
   * keyboard events occur in a sequence, this array of events describe that sequence.
   *
   * ## event
   * an object with a type property, or a string which will be turned into a single press
   *
   * ## event types
   * ### press
   * represents a key press
   *   - `key`: the key for the button pressed
   *   - `events`: optional list of events that occur before this press completes
   *
   * ### wait
   * represents a pause in a sequence
   *   - `ms`: the number of milliseconds that the pause takes
   *
   * ### repeat
   * represents a key being repeated because it is held down. Should only exist as a
   * sub event of `press` events.
   *   - `count`: the number of times the repeat occurs
   *
   * @param  {element} $el - jQuery element where events should occur
   * @param  {[type]} sequence - an array of events
   * @async
   */
  return function ($el, sequence) {
    var modifierState = {
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false
    };

    return doList(_.clone(sequence));

    function setModifier(key, state) {
      var name = key + 'Key';
      if (modifierState.hasOwnProperty(name)) {
        modifierState[name] = !!state;
      }
    }

    function doList(list) {
      return Promise.try(function () {
        if (!list || !list.length) return;

        var event = list[0];
        if (_.isString(event)) {
          event = { type: 'press', key: event };
        }

        switch (event.type) {
        case 'press':
          return Promise.resolve()
          .then(_.partial(fire, 'keydown', event.key))
          .then(_.partial(fire, 'keypress', event.key))
          .then(_.partial(doList, event.events))
          .then(_.partial(fire, 'keyup', event.key));

        case 'wait':
          return Promise.delay(event.ms);

        case 'repeat':
          return (function again(remaining) {
            if (!remaining) return Promise.resolve();
            remaining = remaining - 1;
            return Promise.resolve()
            .then(_.partial(fire, 'keydown', event.key, true))
            .then(_.partial(fire, 'keypress', event.key, true))
            .then(_.partial(again, remaining));
          }(event.count));

        default:
          throw new TypeError('invalid event type "' + event.type + '"');
        }
      })
      .then(function () {
        if (_.size(list) > 1) return doList(list.slice(1));
      });
    }

    function fire(type, key, repeat) {
      var keyCode = reverseKeyMap[key];
      if (!keyCode) throw new TypeError('invalid key "' + key + '"');

      if (type === 'keydown') setModifier(key, true);
      if (type === 'keyup') setModifier(key, false);

      var $target = _.isFunction($el) ? $el() : $el;
      $target.trigger($.Event(type, _.defaults({ keyCode: keyCode }, modifierState)));
    }
  };
});