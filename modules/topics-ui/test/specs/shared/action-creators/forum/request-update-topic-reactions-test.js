import {equal} from 'assert';

import createAction from '../../../../../shared/action-creators/forum/request-update-topic-reactions';
import { REQUEST_UPDATE_TOPIC_REACTIONS } from '../../../../../shared/constants/forum.js';

describe('requestUpdateTopicReactions', () => {

  it('should return the right type', () => {
    equal(createAction().type, REQUEST_UPDATE_TOPIC_REACTIONS);
  });

});
