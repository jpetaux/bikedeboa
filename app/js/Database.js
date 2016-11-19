var BIKE = BIKE || {};

BIKE.Database = {
  ///////////////////
  // G L O B A L S //
  ///////////////////

  // API path, without the final slash ('/')
  API_URL: 'https://bikedeboa-api.herokuapp.com',
  // API_URL: 'http://localhost:3000',
  _authToken: '',
  _headers: {},


  ///////////////////
  // M E T H O D S //
  ///////////////////

  _removeAll: function() {
    var self = this;

    console.log('Removing all entries in 5 seconds...');

    setTimeout(function() {
      $.ajax({
        url: self.API_URL + '/local',
        type: 'DELETE',
        headers: self._headers,
      }).done(function(data) {
        console.log(data);
      });
    }, 5000);
  },

  _sendAllMarkersToBackend: function(isToMock) {
    const self = this;
    let allMarkers = BIKE.MockedDatabase.allMarkers;

    if (isToMock) {
      allMarkers = BIKE.MockedDatabase.mockData(allMarkers);
    } else if (isToMock !== false) {
      console.error('Please specify if you want to mock content or not.');
      return;
    }


    console.log('Sending ALL ' + allMarkers.length + ' places.');

    allMarkers.forEach(function(m){
      $.ajax({
        type: 'post',
        headers: self._headers,
        url: self.API_URL + '/local',
        data: m
      });
    });
  },

  customAPICall: function(type, endpoint, data, callback) {
    var self = this;

    if (!type) {
      console.error('no type');
    }
    if (!endpoint) {
      console.error('no endpoint');
    }
  
    $.ajax({
      type: type,
      headers: self._headers,
      url: self.API_URL + '/' + endpoint,
      data: data,
      success: function(data) {
        console.log('_customCall success.');
        console.log(data);

        if (callback && typeof callback === 'function') {
          callback();
        }
      }
    });
  },

  sendCheckin: function(placeId, callback) {
    var self = this;

    $.ajax({
      type: 'post',
      headers: self._headers,
      url: self.API_URL + '/checkin',
      data: {
        idLocal: placeId,
      },
      success: function(data) {
        console.log('Check-in success.');

        if (callback && typeof callback === 'function') {
          callback();
        }
      }
    });
  },

  authenticate: function(callback) {
    var self = this;

    // Custom login
    const isLogin = window.location.pathname === '/login';
    let user, pw;
    if (isLogin) {
      user = prompt('Bem-vindo colaborador(a)! Qual teu usuario?','');
    }

    $.ajax({
      type: 'post',
      headers: self._headers,
      url: self.API_URL + '/token',
      data: {
        username: user || 'cristiano',
        password: pw || 'abcd123'
      },
      success: function(data) {
        if (data.token && data.token.length > 0) {
          console.log('Authentication successful.');
          self._authToken = data.token;
          self._headers = {
            'x-access-token': data.token
          };

          if (callback && typeof callback === 'function') {
            callback();
          }
        }
      }
    });
  },

  sendReview: function(placeId, rating, tags, callback) {
    var self = this;

    $.ajax({
      type: 'post',
      headers: self._headers,
      url: self.API_URL + '/review',
      data: {
        idLocal: placeId,
        rating: rating,
        tags: tags
      },
      success: function(data) {
        console.log('Review success.');

        if (callback && typeof callback === 'function') {
          callback();
        }
      }
    });
  },

  sendPlace: function(place, callback) {
    var self = this;

    console.log('Sending new place:');
    console.log(place);

    $.ajax({
      type: 'post',
      headers: self._headers,
      url: self.API_URL + '/local',
      data: place,
      error: function(e) {
        console.error(e);
      },
      success: function(data) {
        console.log('Addition success!');

        if (callback && typeof callback === 'function') {
          callback();
        }
      }
    });
  },

  updatePlace: function(placeId, data, callback) {
    var self = this;

    $.ajax({
      type: 'put',
      headers: self._headers,
      url: self.API_URL + '/local' + placeId,
      data: data,
      error: function(e) {
        console.error(e);
      },
      success: function(data) {
        console.log('Update successful!');

        if (callback && typeof callback === 'function') {
          callback();
        }
      }
    });
  },

  getAllTags: function(successCB, failCB, alwaysCB) {
    var self = this;

    console.log('Getting tags...');

    $.ajax({
      type: 'get',
      headers: self._headers,
      url: self.API_URL + '/tag'
    }).done(function(data) {
      if (data && data.length > 0) {
        console.log('Successfully retrieved ' + data.length + ' tags.');

        tags = data;

        idToTag = {};
        tagToId = {};
        tags.forEach(tagObj => {
          idToTag[tagObj.id] = tagObj.name;
          tagToId[tagObj.name] = tagObj.id;
        });

        if (successCB && typeof successCB === 'function') {
          successCB();
        }
      } else if (failCB && typeof failCB === 'function') {
        failCB();
      }
    })
    .fail(function() {
      if (failCB && typeof failCB === 'function') {
        failCB();
      }
    })
    .always(function() {
      if (alwaysCB && typeof alwaysCB === 'function') {
        alwaysCB();
      }
    });
  },

  getPlaces: function(successCB, failCB, alwaysCB) {
    var self = this;

    console.log('Getting all places...');

    $.ajax({
      type: 'get',
      headers: self._headers,
      url: self.API_URL + '/local/light'
    }).done(function(data) {
      console.log('Successfully retrieved ' + data.length + ' places!');

      markers = data;

      markers.forEach(m => {
        // Mark that no markers have retrieved their details
        m._hasDetails = false;

        // Massage average format
        if (typeof m.average === 'string') {
          m.average = parseFloat(m.average);
        }
      });

      if (successCB && typeof successCB === 'function') {
        successCB();
      }
    })
    .fail(function() {
      if (failCB && typeof failCB === 'function') {
        failCB();
      }
    })
    .always(function() {
      if (alwaysCB && typeof alwaysCB === 'function') {
        alwaysCB();
      }
    });
  },

  getPlaceDetails: function(placeId, successCB, failCB, alwaysCB) {
    var self = this;

    console.log('Getting place detail...');

    $.ajax({
      type: 'get',
      headers: self._headers,
      url: self.API_URL + '/local/' + placeId
    }).done(function(data) {
      if (data) {
        console.log('Got place detail:');
        console.log(data);

        let updatedMarker = markers.find(m => {return m.id === placeId; });
        
        Object.assign(updatedMarker, data);

        updatedMarker._hasDetails = true;

        if (successCB && typeof successCB === 'function') {
          successCB();
        }
      }
    })
    .fail(function() {
      if (failCB && typeof failCB === 'function') {
        failCB();
      }
    })
    .always(function() {
      if (alwaysCB && typeof alwaysCB === 'function') {
        alwaysCB();
      }
    });
  },
};
