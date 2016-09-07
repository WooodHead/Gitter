//TODO Extend a Topic Model
import Backbone from 'backbone';
import {subscribe} from '../../../shared/dispatcher';
import * as consts from '../../../shared/constants/create-topic';

export default Backbone.Model.extend({

  defaults: {
    tags: [],
  },

  initialize(){
    subscribe(consts.TITLE_UPDATE, this.onTitleUpdate, this);
    subscribe(consts.BODY_UPDATE, this.onBodyUpdate, this);
    subscribe(consts.CATEGORY_UPDATE, this.onCategoryUpdate, this);
    subscribe(consts.TAGS_UPDATE, this.onTagsUpdate, this);
  },

  onTitleUpdate(data){
    this.set('title', data.title);
  },

  onBodyUpdate(data){
    this.set('body', data.body);
  },

  onCategoryUpdate(data){
    this.set('categoryId', data.categoryId);
  },

  onTagsUpdate(data){
    const tag = data.tags;
    const currentTags = this.get('tags');
    if(currentTags.indexOf(tag) !== -1) { return; }
    currentTags.push(tag);
    this.set('tags', currentTags);
  }

});
