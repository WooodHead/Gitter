'use strict';

var React = require('react');
var CategoryList = require('../shared/components/forum/category-list.jsx');

module.exports = React.createClass({

  displayName: 'ForumContainer',

  propTypes: {
    groupName: React.PropTypes.string.isRequired,
    categoryStore: React.PropTypes.shape({
      models: React.PropTypes.array.isRequired,
      getCategories: React.PropTypes.func.isRequired
    }).isRequired
  },

  render() {
    //TODO migrate this into state
    const categories = this.props.categoryStore.getCategories();
    const { groupName } = this.props;
    return (
      //Search header ...
      <CategoryList categories={ categories } groupName={ groupName }  onCategoryClicked={ this.onCategoryClicked } />
    );
  },

  onCategoryClicked(){
    console.log('this is working');
  }

});
