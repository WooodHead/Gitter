import Backbone from 'backbone';
import _ from 'lodash';
import {subscribe} from '../../../shared/dispatcher';
import SimpleFilteredCollection from 'gitter-realtime-client/lib/simple-filtered-collection';

import LiveCollection from './live-collection';
import {BaseModel} from './base-model';

import parseTag from '../../../shared/parse/tag';
import {getRealtimeClient} from './realtime-client';
import {getForumId, getForumStore} from './forum-store';
import router from '../routers';

import dispatchOnChangeMixin from './mixins/dispatch-on-change';
import {SUBMIT_NEW_TOPIC, TOPIC_CREATED} from '../../../shared/constants/create-topic';

export const TopicModel = BaseModel.extend({
  url(){
    return this.get('id') ? null : `/api/v1/forums/${getForumId()}/topics`;
  },

  toJSON() {
    var data = this.attributes;
    data.tags = (data.tags || []);
    return Object.assign({}, data, {
      tags: data.tags.map(parseTag),
      categoryId: this.collection.getCategoryId(),
    });
  }
});

export const TopicsLiveCollection = LiveCollection.extend({

  model: TopicModel,
  client: getRealtimeClient(),
  urlTemplate: '/v1/forums/:forumId/topics',

  getContextModel(){
    return new Backbone.Model({
      forumId: getForumId()
    });
  },

  initialize(){
    subscribe(SUBMIT_NEW_TOPIC, this.createNewTopic, this);
  },

  createNewTopic(data){
    const model = this.create({ title: data.title, text: data.body }, { wait: true });
    model.once('add', () => {
      this.trigger(TOPIC_CREATED, {
        topicId: model.get('id'),
        slug: model.get('slug')
      });
    });
  },

});

export class TopicsStore {

  constructor(models, options) {
    _.extend(this, Backbone.Events);

    this.topicCollection = new TopicsLiveCollection(models, options);

    this.collection = new SimpleFilteredCollection([], {
      collection: this.topicCollection,
      filter: this.getFilter(),
    });

    this.listenTo(router, 'change:categoryName', this.onRouterUpdate, this);
  }

  getFilter() {
    // Why is this called name, when the tests actually
    // use the slug? @cutandpastey?
    const categoryName = router.get('categoryName');
    if (categoryName && categoryName !== "all") {
      return function(model) {
        var category = model.get('category');
        return category && (category.slug === categoryName);
      };
    } else {
      return function() {
        return true;
      }
    }
  }

  getTopics() {
    return this.collection.toJSON();
  }

  getById(id) {
    const model = this.collection.get(id);
    if(!model) { return; }
    return model.toJSON();
  }

  onRouterUpdate() {
    this.collection.setFilter(this.getFilter());
  }
}



dispatchOnChangeMixin(TopicsStore);

const serverStore = (window.context.topicsStore || {});
const serverData = (serverStore.data || []);
let store;
export function getTopicsStore(data){
  if(!store) { store = new TopicsStore(serverData); }
  if(data) { store.set(data); }
  return store;
}
