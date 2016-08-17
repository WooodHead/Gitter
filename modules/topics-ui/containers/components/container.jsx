"use strict";

var React = require('react');
var classNames = require('classnames');

module.exports = React.createClass({

  displayName: 'Container',
  propTypes: {
    className: React.PropTypes.string,
    children: React.PropTypes.node
  },

  render(){

    const { className } = this.props;
    const compiledClass = classNames('container', className);

    return (
      <div className={compiledClass} >{this.props.children}</div>
    );
  }
})
