/* eslint no-console: ["warn", { allow: ["log", "warn", "error"] }] */
/* eslint-env node, jquery */

$(() => {
  let start_coords = DEFAULT_COORDS;
  let zoom = 15;
  let getGeolocation = true;

  function openShareDialog() {
    // const shareUrl = window.location.origin + BDB.Places.getMarkerShareUrl(openedMarker);
    const shareUrl = 'https://www.bikedeboa.com.br' + BDB.Places.getMarkerShareUrl(openedMarker);

    if (navigator.share) {
      navigator.share({
        title: 'bike de boa',
        text: openedMarker.text,
        url: shareUrl,
      })
      .then(() => {})
      .catch((error) => console.error('ERROR sharing', error));
    } else {
      swal({  
        imageUrl: _isMobile ? '' : '/img/icon_share.svg',
        imageWidth: 80,
        imageHeight: 80,
        customClass: 'share-modal',
        html:
          `Compartilhe este bicicletário<br><br>
          <div class="share-icons">
            <iframe src="https://www.facebook.com/plugins/share_button.php?href=${encodeURIComponent(shareUrl)}&layout=button&size=large&mobile_iframe=true&width=120&height=28&appId=1814653185457307" width="120" height="28" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowTransparency="true"></iframe>
            <a target="_blank" href="https://twitter.com/share" data-size="large" class="twitter-share-button"></a>
            <button class="share-email-btn">
              <a target="_blank" href="mailto:?subject=Saca só esse bicicletário&amp;body=${shareUrl}" title="Enviar por email">
                <img src="/img/icon_mail.svg" class="icon-mail"/><span class="share-email-label unstyled-link">Email</span> 
              </a>
            </button>
          </div>
          <hr>
          ...ou clique para copiar o link<br><br>
          <div class="share-url-container">
            <span class="glyphicon glyphicon-link share-url-icon"></span>
            <textarea id="share-url-btn" onclick="this.focus();this.select();" readonly="readonly" rows="1" data-toggle="tooltip" data-trigger="manual" data-placement="top" data-html="true" data-title="Copiado!">${shareUrl}</textarea>
          </div>`,
        showConfirmButton: false,
        showCloseButton: true,
        onOpen: () => {
          // Initializes Twitter share button
          twttr.widgets.load();

          // Copy share URL to clipboard
          $('#share-url-btn').on('click', e => {
            ga('send', 'event', 'Local', 'share - copy url to clipboard', ''+openedMarker.id);

            copyToClipboard(e.currentTarget);
   
            // Tooltip
            $('#share-url-btn').tooltip('show');
            $('#share-url-btn').one('mouseout', () => {
              $('#share-url-btn').tooltip('hide');
            });
          });
        }
      });
    }

  }

  function initHelpTooltip(selector) {
    if (!_isMobile) {
      $(selector).tooltip({
        trigger: 'focus'
      }); 
    } else {
      $(selector).off('click').on('click', e => {
        const $tooltipEl = $(e.currentTarget);
        swal({
          customClass: 'tooltip-modal',
          html: $tooltipEl.data('title'), 
          showConfirmButton: false,
          showCloseButton: true
        });
      });
    }
  }

  function openDetailsModal(marker, callback) {
    if (!marker) {
      console.error('Trying to open details modal without a marker.');
      return;
    }
    
    if (addLocationMode) {
      return;
    }

    openedMarker = marker;
    const m = openedMarker;
 
    let templateData = {
      title: m.text,
      address: m.address,
      description: m.description,
      author: m.User && m.User.fullname,
      views: m.views,
      reviews: m.reviews,
      lat: m.lat,
      lng: m.lng,
      slots: m.slots
    }
    
    // Average
    templateData.pinColor = getColorFromAverage(m.average);
    templateData.average = formatAverage(m.average);

    // Minimap
    const staticImgDimensions = _isMobile ? '400x100' : '1000x150';
    templateData.mapStaticImg = BDB.Map.getStaticImgMap(staticImgDimensions, templateData.pinColor, m.lat, m.lng);
  
    // Tags
    if (tags && m.tags && m.tags.length > 0) {
      const MAX_TAG_COUNT = m.reviews;
      const MIN_TAG_OPACITY = 0.3;

      let allTags = [];
      tags.forEach( t => {
        const found = m.tags.find( el => el.name === t.name );
        if (found) {
          allTags.push(found);
        } else {
          allTags.push({name: t.name, count: 0});
        }
      });

      // templateData.tags = m.tags
      templateData.tags = allTags 
        .sort((a, b) => {return b.count - a.count;})
        .map(t => {
          // Tag opacity is proportional to count
          // @todo refactor this to take into account Handlebars native support for arrays
          const opacity = t.count/MAX_TAG_COUNT + MIN_TAG_OPACITY;
          // return t.count > 0 ? `<span class="tagDisplay" style="opacity: ${opacity}">${t.name} <span class="tag-count">${t.count}</span></span>` : '';
          return `
            <span class="tagDisplayContainer">
              <span class="tagDisplay" style="opacity: ${opacity}">
                ${t.name} <span class="tag-count">${t.count}</span>
              </span>
            </span>
          `;
        })
        .join('');
    }

    // Reviews, checkins
    if (m.reviews === '0') {
      templateData.numReviews = 'Nenhuma avaliação :(';
    } else if (m.reviews === '1') {
      templateData.numReviews = '1 avaliação';
    } else {
      templateData.numReviews = `${m.reviews} avaliações`;
    }
    
    // templateData.numCheckins = m.checkin && (m.checkin + ' check-ins') || '';

    // User permissions
    if (BDB.User.isAdmin) {
      templateData.isAdmin = true;
      templateData.canModify = true;
    } else {
      if (BDB.User.checkEditPermission(m.id)) {
        templateData.canModify = true;
      }
    }

    // Data source
    if (m.DataSource) {
      templateData.dataSourceName = m.DataSource.name;
    }

    // Is paid
    if (m.isPaid !== null) {
      if (m.isPaid === true) {
        templateData.isPaid = 'Pago';
      } else {
        templateData.isPaid = 'Gratuito';
      }
    }

    // Created at
    if (m.createdAt) {
      templateData.createdTimeAgo = createdAtToDaysAgo(m.createdAt);
    }

    // Show directions button 
    // templateData.gmapsRedirectUrl = `https://maps.google.com/maps/preview?daddr=${m.lat},${m.lng}&dirflg=b`;
    templateData.gmapsRedirectUrl = `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}&travelmode=bicycling`; 

    // Photo
    if (m.photo) {
      templateData.photoUrl = m.photo;
      
      if (_isMobile && !_isDeeplink) {
        $('body').addClass('transparent-mobile-topbar');
      }
    }

    // Is public? 
    if (m.isPublic != null) {
      templateData.isPublic = m.isPublic === true;
    } else {
      templateData.noIsPublicData = true;
    }

    // Is covered?
    if (m.isCovered != null) {
      templateData.isCovered = m.isCovered === true;
    } else {
      templateData.noIsCoveredData = true;
    }

    // Structure type
    let structureTypeIcon;
    switch (m.structureType) {
    case 'uinvertido': structureTypeIcon = '/img/tipo_uinvertido.svg'; break;
    case 'deroda': structureTypeIcon = '/img/tipo_deroda.svg'; break;
    case 'trave': structureTypeIcon = '/img/tipo_trave.svg'; break;
    case 'suspenso': structureTypeIcon = '/img/tipo_suspenso.svg'; break;
    case 'grade': structureTypeIcon = '/img/tipo_grade.svg'; break;
    case 'other': structureTypeIcon = '/img/tipo_other.svg'; break;
    }
    if (m.structureType) {
      templateData.structureTypeCode = m.structureType;
      templateData.structureTypeLabel = STRUCTURE_CODE_TO_NAME[m.structureType];
    }
    templateData.structureTypeIcon = structureTypeIcon;

    // Retrieves a previous review saved in session
    const previousReview = BDB.User.getReviewByPlaceId(m.id);
    if (previousReview) {
      const rating = previousReview.rating;
      
      templateData.color = getColorFromAverage(rating);

      // @todo modularize this method
      let stars = '';
      for (let s = 0; s < parseInt(rating); s++) {
        stars += '<span class="glyphicon glyphicon-star"></span>';
      }
      templateData.savedRatingContent = rating + stars;
    } else {
      if (BDB.User && BDB.User.profile && BDB.User.profile.thumbnail) {
        templateData.userThumbUrl = BDB.User.profile.thumbnail; 
      }
    }



    ////////////////////////////////
    // Render handlebars template // 
    ////////////////////////////////
    $('#placeDetailsContent').html(BDB.templates.placeDetailsContent(templateData));

    if (m.average) {
      $('input[name=placeDetails_rating]').val(['' + Math.round(m.average)]);
    } else {
      $('#ratingDisplay').addClass('empty');
    }

    $('.photo-container img').on('load', e => {
      $(e.target).parent().parent().removeClass('loading');
    });

    $('#placeDetailsModal .openDataSourceDialog').off('click').on('click', () => {
      if (openedMarker) { 
        swal({
          showCloseButton: true,
          showConfirmButton: false,
          html:
            `Este bicicletário foi importado de:
            <h3>${openedMarker.DataSource.name}</h3>
            <p> <a target="_blank" rel="noopener" href="${openedMarker.DataSource.url}">${openedMarker.DataSource.url}</a>`,
        });
      }
    });
 
    // Init click callbacks
    // $('#checkinBtn').on('click', sendCheckinBtn);
    $('.rating-input-container .full-star, .openReviewPanelBtn').off('click').on('click', e => {
      openReviewModal($(e.target).data('value'));
    });
    $('.shareBtn').off('click').on('click', e => {
      ga('send', 'event', 'Local', 'share', ''+openedMarker.id);
      
      openShareDialog();
    });
    $('.photo-container img').off('click').on('click', e => {
      toggleExpandModalHeader();
    });
    $('.directionsBtn').off('click').on('click', e => {
      ga('send', 'event', 'Local', 'directions', ''+openedMarker.id);
    });
    $('.editPlaceBtn').off('click').on('click', queueUiCallback.bind(this, openNewOrEditPlaceModal));
    $('.deletePlaceBtn').off('click').on('click', queueUiCallback.bind(this, deletePlace));
    $('.createRevisionBtn').off('click').on('click', queueUiCallback.bind(this, () => {
      if (!BDB.User.isLoggedIn) {
        // @todo fix to not need to close the modal
        hideAll();
        openLoginDialog(true);
      } else {
        openRevisionDialog();
      }
    }));

    // RENDER
    if (!$('#placeDetailsModal').is(':visible')) {
      // $('section, .modal-footer').css({opacity: 0});

      // Analytics stuff
      ga('send', 'event', 'Local', 'view', '' + m.id);
      const userCurrentPosition = BDB.Geolocation.getCurrentPosition();
      if (userCurrentPosition) {
        const distanceKm = distanceInKmBetweenEarthCoordinates(
          userCurrentPosition.latitude, userCurrentPosition.longitude, openedMarker.lat, openedMarker.lng);
        const distanceMeters = parseInt(distanceKm * 1000);

        console.log(`[Analytics] Local / distance from user (m) / ${distanceMeters}`);
        ga('send', 'event', 'Local', 'distance from user (m)', null, distanceMeters);
      }

      // Modal stuff
      $('#placeDetailsModal')
        .one('show.bs.modal', () => { 
          // Global states
          $('body').addClass('details-view');
          if (previousReview) {
            $('body').addClass('already-reviewed');
          } else {
            $('body').removeClass('already-reviewed');
          }
          // if (m.photo) {
          //   $('body').addClass('gradient-topbar');
          // }
        }) 
        .one('shown.bs.modal', () => { 
          // Animate modal content
          // $('section, .modal-footer').velocity('transition.slideDownIn', {stagger: STAGGER_NORMAL, queue: false});
          // if (!templateData.savedRating) {
          //   $('#bottom-mobile-bar').velocity("slideDown", { easing: 'ease-out', duration: 700 });
          // }

          // Fixes bug in which Bootstrap modal wouldnt let anything outside it be focused
          // Thanks to https://github.com/limonte/sweetalert2/issues/374
          $(document).off('focusin.modal');

          // @todo do this better please
          if (window._openLocalCallback && typeof window._openLocalCallback === 'function') {
            window._openLocalCallback();
            window._openLocalCallback = null;
          }
          if (callback && typeof callback === 'function') {
            callback();
          }
        })
        .one('hidden.bs.modal', () => {
          $('body').removeClass('details-view');
          // $('body').removeClass('gradient-topbar');
        })
        .modal('show');
    } else { 
      // Just fade new detailed content in
      // $('#placeDetailsContent .photo-container, #placeDetailsContent .tagsContainer').velocity('transition.fadeIn', {stagger: STAGGER_NORMAL, queue: false});
      $('#placeDetailsContent .tagsContainer, #placeDetailsContent .description')
        .velocity('transition.fadeIn', {stagger: STAGGER_NORMAL, queue: false, duration: 2000});
    } 

    // Tooltips
    if(!_isTouchDevice) {
      $('#placeDetailsContent .full-star').tooltip({ 
        toggle: 'tooltip',
        placement: 'bottom', 
        'delay': {'show': 0, 'hide': 100}
      });
    }
    initHelpTooltip('#placeDetailsContent .help-tooltip-trigger');

    $('#public-access-help-tooltip').off('show.bs.tooltip').on('show.bs.tooltip', () => {
      ga('send', 'event', 'Misc', 'tooltip - pin details public access');
    });
    $('#private-access-help-tooltip').off('show.bs.tooltip').on('show.bs.tooltip', () => {
      ga('send', 'event', 'Misc', 'tooltip - pin details private access');
    });
    $('#uinvertido-type-help-tooltip').off('show.bs.tooltip').on('show.bs.tooltip', () => {
      ga('send', 'event', 'Misc', 'tooltip - pin details uinvertido type');
    });
    $('#deroda-type-help-tooltip').off('show.bs.tooltip').on('show.bs.tooltip', () => {
      ga('send', 'event', 'Misc', 'tooltip - pin details deroda type');
    });
    $('#trave-type-help-tooltip').off('show.bs.tooltip').on('show.bs.tooltip', () => {
      ga('send', 'event', 'Misc', 'tooltip - pin details trave type');
    });
    $('#suspenso-type-help-tooltip').off('show.bs.tooltip').on('show.bs.tooltip', () => {
      ga('send', 'event', 'Misc', 'tooltip - pin details suspenso type');
    });
    $('#grade-type-help-tooltip').off('show.bs.tooltip').on('show.bs.tooltip', () => {
      ga('send', 'event', 'Misc', 'tooltip - pin details grade type');
    });
    $('#other-type-help-tooltip').off('show.bs.tooltip').on('show.bs.tooltip', () => {
      ga('send', 'event', 'Misc', 'tooltip - pin details other type');
    });
  }
 
  // Set router to open Local
  function openLocal(marker, callback) {
    let url = BDB.Places.getMarkerShareUrl(marker);
 
    window._openLocalCallback = callback;

    marker.url = url;
    setView(marker.text || 'Detalhes do bicicletário', url);
  }

  function openLocalById(id, callback) {
    const place = BDB.Places.getMarkerById(id, callback);
    this.openLocal(place, callback);
  }

  function routerOpenLocal(markerId, callback) {
    const marker = BDB.Places.getMarkerById(markerId)
 
    if (marker) {
      openDetailsModal(marker, callback);

      if (!marker._hasDetails) {
        // Request content
        BDB.Database.getPlaceDetails(marker.id)
          .then(updatedMarker => {
            // Check if details panel is still open...
            if (openedMarker && openedMarker.id === updatedMarker.id) {
              openDetailsModal(updatedMarker, callback); 
            }
          })
          .catch( () => {
            $('.tagsContainer.loading').remove();
          });
      }
    }
  }

  function routerOpenDeeplinkMarker(markerId, callback) {
    BDB.Database.getPlaceDetails(markerId)
      .then(marker => {
        _deeplinkMarker = marker;

        openDetailsModal(marker, callback);
 
        if (!tags) { 
          $(document).on('tags:loaded', () => {
            openDetailsModal(marker, callback);
          });
        }
      });
  }

  function updateFilters() {
    let filters = [];
    $('.filter-checkbox:checked').each( (i, f) => {
      const p = $(f).data('prop');
      let v = $(f).data('value'); 

      filters.push({prop: p, value: v});
    });
 
    const resultsCount = applyFilters(filters);
    if (filters.length > 0) {
      $('#filter-results-counter').html(resultsCount);
      $('#active-filters-counter').html(filters.length);
      $('#filterBtn').toggleClass('active', true);
      $('#filter-results-counter-container').velocity({ opacity: 1 });
      $('#clear-filters-btn').velocity({ opacity: 1 });
    } else {
      $('#filter-results-counter-container').velocity({ opacity: 0 });
      $('#clear-filters-btn').velocity({ opacity: 0 });
      $('#active-filters-counter').html('');
      $('#filterBtn').toggleClass('active', false);
    }
  }

  // Array of filters in the form of [{prop: 'a property', value: 'a value'}, ...]
  // Logical expression: 
  //   showIt = (prop1_val1 OR ... OR prop1_valN) AND
  //            (prop2_val1 OR ... OR prop2_valN) AND 
  //            ...
  //            (propN_val1 OR ... OR propN_valN)
  function applyFilters(filters = []) {
    let cont = 0;

    const isPublicFilters = filters.filter(i => i.prop === 'isPublic');
    const isCoveredFilters = filters.filter(i => i.prop === 'isCovered');
    const ratingFilters = filters.filter(i => i.prop === 'rating');
    const structureFilters = filters.filter(i => i.prop === 'structureType');
    const photoFilters = filters.filter(i => i.prop === 'hasPhoto');
    const categories = [isPublicFilters, isCoveredFilters, ratingFilters, structureFilters, photoFilters];

    const tempMarkers = BDB.Map.getMarkers();

    for(let i=0; i < markers.length; i++) {
      const m = markers[i];
      let showIt = true;

      // Apply all filters to this marker
      for(let cat=0; cat < categories.length && showIt; cat++) {
        let catResult = false;
        
        if (categories[cat].length) {
          for(let f_index=0; f_index < categories[cat].length && showIt; f_index++) {
            const f = categories[cat][f_index];
            let testResult;

            switch (f.prop) {
            case 'hasPhoto':
              if (f.value === 'with') {
                testResult = !!m.photo;
              } else {
                testResult = !m.photo;
              }
              break;
            case 'rating':
              switch (f.value) {
              case 'good':
                testResult = m.average >= 3.5;
                break;
              case 'medium':
                testResult = m.average > 2 && m.average < 3.5;
                break;
              case 'bad':
                testResult = m.average > 0 && m.average <= 2;
                break;
              case 'none':
                testResult = m.average === null;
                break;
              }
              break;
            default:
              testResult = m[f.prop] === f.value;
              break;
            }
            
            // Filters inside each category are compared with OR
            catResult = catResult || testResult;
          }
          
          // Category are compared with each other with AND
          showIt = showIt && catResult;
        }
      }

      // tempMarkers[i].setMap(showIt ? map : null);
      tempMarkers[i].setIcon(showIt ? m.icon : m.iconMini);
      tempMarkers[i].setOptions({clickable: showIt, opacity: (showIt ? 1 : 0.3)});
      tempMarkers[i].collapsed = !showIt;
      cont += showIt ? 1 : 0;
    }

    _activeFilters = filters.length;

    return cont;
  }

  function clearFilters() {
    _activeFilters = null;
    BDB.Map.setMapOnAll(map); 
  }

  function toggleLocationInputMode() {
    addLocationMode = !addLocationMode;
    const isTurningOn = addLocationMode;

    if (isTurningOn) {
      $('body').addClass('position-pin-mode');

      hideUI();

      $('.hamburger-button').addClass('back-mode');
      $('.hamburger-button.back-mode').one('click', () => {
        toggleLocationInputMode();
      });
      
      // Change Maps style that shows Points of Interest
      map.setOptions({styles: _gmapsCustomStyle_withLabels});

      $('#newPlaceholderConfirmBtn').on('click', queueUiCallback.bind(this, () => {
        // Queries Google Geocoding service for the position address
        const mapCenter = map.getCenter();
        
        // Saves this position for later
        _newMarkerTemp = {lat: mapCenter.lat(), lng: mapCenter.lng()};
        BDB.Map.reverseGeocode(_newMarkerTemp.lat, _newMarkerTemp.lng)
          .then( (addressObj) => {
            // console.log('Resolved location address:');
            // console.log(address);
            _newMarkerTemp.address = addressObj.address;
            _newMarkerTemp.city = addressObj.city;
            _newMarkerTemp.state = addressObj.state;
            _newMarkerTemp.country = addressObj.country;
          });

        if (openedMarker) {
          // Was editing the marker position, so return to Edit Modal
          const mapCenter = map.getCenter();
          openedMarker.lat = mapCenter.lat();
          openedMarker.lng = mapCenter.lng();
          
          // Will be automatically triggered on toggleLocationInputMode()
          // openNewOrEditPlaceModal();
        } else {
          if (BDB.Map.checkBounds()) {
            openNewOrEditPlaceModal();
          } else {
            const mapCenter = map.getCenter();
            ga('send', 'event', 'Local', 'out of bounds', `${mapCenter.lat()}, ${mapCenter.lng()}`); 

            swal({
              title: 'Ops',
              html:
                `Foi mal, o bike de boa ainda não chegou aqui!
                <br><br>
                <small>
                  <i>Acompanha nosso <a class="external-link" target="_blank" rel="noopener" href="https://www.facebook.com/bikedeboaapp">
                  Facebook</a> para saber novidades sobre nossa cobertura, e otras cositas mas. :)</i>
                </small>`,
              type: 'warning',
            });
          }
        }

        toggleLocationInputMode();
      }));

      // ESC button cancels locationinput
      $(document).on('keyup.disableInput', e => {
        if (e.keyCode === 27) {
          toggleLocationInputMode();
        }
      });

      // Adjust for a minimum zoom for improved recommended precision
      // if (map.getZoom() < 18) {
      //   map.setZoom(18);
      // }
    } else {
      // Turning OFF

      map.setOptions({styles: _gmapsCustomStyle});

      showUI();
      $('.hamburger-button').removeClass('back-mode'); 
      $('.hamburger-button.back-mode').off('click');
      $('#newPlaceholderConfirmBtn').off('click');
      $(document).off('keyup.disableInput');
      $('body').removeClass('position-pin-mode');
      
      // Clear centerChanged event
      // if (map) {
      //   google.maps.event.clearInstanceListeners(map);
      // }
    }

    BDB.Map.toggleMarkers();
    if (_isMobile) {
      $('#addPlace').toggle();
    } else {
      $('#addPlace').toggleClass('active');
    }
    $('#addPlace > span').toggle();
    $('#newPlaceholder').toggleClass('active');
    $('#newPlaceholderTarget').toggle();
    $('#newPlaceholderConfirmBtn').toggle();
    // $('#geolocationBtn').toggle();

    if (!isTurningOn && openedMarker) { 
      // Was editing the marker position, so return to Edit Modal
      openNewOrEditPlaceModal();
    }
  }

  function showUI() {
    $('.cool-hide').removeClass('cool-hidden');
  }

  function hideUI() {
    $('.cool-hide').addClass('cool-hidden');
  }

  // @todo refactor this, it's fuckin confusing
  function finishCreateOrUpdatePlace() {
    const updatingMarker = openedMarker;
    openedMarker = null;
    
    goHome();
    showSpinner('Salvando...', _uploadingPhotoBlob ? true : false);

    let place = {};

    // If we were editing this place's position
    if (_newMarkerTemp) {
      place.lat = _newMarkerTemp.lat;
      place.lng = _newMarkerTemp.lng;
      if (_newMarkerTemp.address) {
        place.address = _newMarkerTemp.address;
        place.city = _newMarkerTemp.city;
        place.state = _newMarkerTemp.state;
        place.country = _newMarkerTemp.country;
      } 
      _newMarkerTemp = null;
    }

    const container = $('#newPlaceModal');
    const formFields = {
      text: container.find('#titleInput').val(),
      public: container.find('.acess-types-group .active').data('value'),
      covered: container.find('.covered-group .active').data('value'),
      structureType: container.find('.custom-radio-group .active').data('value'),
      description: container.find('#descriptionInput').val(),
      slots: container.find('#slotsInput').val(),
      isPaid: container.find('#isPaidInput').val(),
    }

    place.text = formFields.text;
    place.structureType = formFields.structureType;
    place.description = formFields.description;
    place.slots = formFields.slots;

    place.photo = _uploadingPhotoBlob;
    _uploadingPhotoBlob = '';

    if (formFields.covered) {
      place.isCovered = formFields.covered === 'covered';
    } else {
      place.isCovered = null; 
    }

    if (formFields.public) {
      place.isPublic = formFields.public === 'public';
    } else {
      place.isPublic = null;
    }

    if (formFields.isPaid && formFields.isPaid !== 'dontknow') {
      place.isPaid = (formFields.isPaid === 'yes');
    }
 
    const onPlaceSaved = newPlace => {
      if (!updatingMarker) {
        BDB.User.saveNewPlace(newPlace.id);
      } else {
        // Doesnt block the user from viewing the map if it was just updating the pin
        hideSpinner();
        toastr['success']('Bicicletário atualizado.');
      }

      BDB.Database.getPlaces( () => {
        BDB.Map.updateMarkers();
        
        hideSpinner();

        if (!updatingMarker) {
          const newMarker = markers.find( i => i.id === newPlace.id );
          if (newMarker) {
            // promptPWAInstallPopup();

            swal({
              title: 'Bicicletário criado',
              customClass: 'post-create-modal',
              type: 'success',
              html:
                `<section class="rating-input-container">
                  <p> 
                    Que tal já deixar sua avaliação?
                  </p>  

                  <fieldset class="rating empty">
                      <input disabled type="radio" id="star5_input" name="rating_input" value="5" />
                      <label class="full-star" data-value="5" for="star5_input"></label> 
                      <input disabled type="radio" id="star4_input" name="rating_input" value="4" />
                      <label class="full-star" data-value="4" for="star4_input"></label>
                      <input disabled type="radio" id="star3_input" name="rating_input" value="3" />
                      <label class="full-star" data-value="3" for="star3_input"></label>
                      <input disabled type="radio" id="star2_input" name="rating_input" value="2" />
                      <label class="full-star" data-value="2" for="star2_input"></label>
                      <input disabled type="radio" id="star1_input" name="rating_input" value="1" />
                      <label class="full-star" data-value="1" for="star1"></label>
                  </fieldset>
              </section>`,
              confirmButtonText: 'Avaliar outra hora',
              showCloseButton: true,
              onOpen: () => { 
                $('.post-create-modal .rating-input-container .full-star').on('click', e => {
                  openedMarker = newMarker;
                  openReviewModal($(e.target).data('value'));
                });
              }
            });
          }
        }
      }); 
    };

    if (updatingMarker) {
      ga('send', 'event', 'Local', 'update', ''+updatingMarker.id);
      BDB.Database.updatePlace(updatingMarker.id, place, onPlaceSaved);
    } else {
      ga('send', 'event', 'Local', 'create');
      BDB.Database.sendPlace(place, onPlaceSaved);
    }
  }

  function photoUploadCB(e) {
    if (e.target.result) {
      // $('#photoInput + label').fadeOut();
      
      resizeImage(e.target.result)
        .then( resizedBlob => {
          _uploadingPhotoBlob = resizedBlob;

          // Present to the user the already resized image
          document.getElementById('photoInputBg').src = _uploadingPhotoBlob;
          $('#newPlaceModal #photoInput+label').addClass('photo-input--edit-mode');
        })
    }

    hideSpinner();
  }

  function validateNewPlaceForm() {
    const textOk = $('#newPlaceModal #titleInput').is(':valid');
    const isOk =
      textOk &&
      // $('#newPlaceModal input:radio[name=isPublicRadioGrp]:checked').val() &&
      $('#newPlaceModal .acess-types-group .active').data('value') &&
      $('#newPlaceModal .covered-group .active').data('value') &&
      $('#newPlaceModal .custom-radio-group .active').data('value');

    // console.log('validating');

    $('#newPlaceModal .saveNewPlaceBtn').prop('disabled', !isOk);
  }

  // @todo clean up this mess
  function openNewOrEditPlaceModal() {
    $('#newPlaceModal').remove();
    $('body').append(BDB.templates.newPlaceModal());
    
    $('#newPlaceModal h1').html(openedMarker ? 'Editando bicicletário' : 'Novo bicicletário'); 

    $('#newPlaceModal .minimap-container').toggle(!!openedMarker);  

    initHelpTooltip('#newPlaceModal .help-tooltip-trigger');

    // Not creating a new one, but editing
    if (openedMarker) {
      // @todo refactor all of this, probably separate into different functions for NEW and EDIT modes
      const m = openedMarker;

      setView('Editar bicicletário', '/editar');

      ga('send', 'event', 'Local', 'update - pending', ''+m.id);

      $('#newPlaceModal #cancelEditPlaceBtn').show();
      $('#newPlaceModal .photoInputDisclaimer').show(); 

      $('#newPlaceModal #titleInput').val(m.text);
      $('#newPlaceModal .saveNewPlaceBtn').prop('disabled', false);
      $(`#newPlaceModal .custom-radio-group [data-value="${m.structureType}"]`).addClass('active');
      if (m.isPublic !== null) {
        $(`#newPlaceModal .acess-types-group [data-value="${m.isPublic ? 'public' : 'private'}"]`).addClass('active');
      }
      if (m.isCovered !== null) { 
        $(`#newPlaceModal .covered-group [data-value="${m.isCovered ? 'covered' : 'uncovered'}"]`).addClass('active');
      }
      if (m.isPaid !== null) {
        $('#newPlaceModal #isPaidInput').val(m.isPaid ? 'yes' : 'no');
      }
      
      // $(`#newPlaceModal input[name=isPublicRadioGrp][value="${m.isPublic}"]`).prop('checked', true);
      $('#newPlaceModal #photoInputBg').attr('src', m.photo);
      $('#newPlaceModal #descriptionInput').val(m.description);
      $('#newPlaceModal #slotsInput').val(m.slots);

      // Minimap
      // @todo generalize this
      const staticImgDimensions = _isMobile ? '400x100' : '1000x100';
      const minimapUrl = BDB.Map.getStaticImgMap(staticImgDimensions, getColorFromAverage(m.average), m.lat, m.lng, 20);
      $('#newPlaceModal .minimap').attr('src', minimapUrl);

      // More info section
      if (m.description && m.description.length > 0) {
        $('#newPlaceModal .description').addClass('expanded');
      }

      if (openedMarker.photo.length > 0) {
        $('#newPlaceModal #photoInput+label').addClass('photo-input--edit-mode');
      }

      // $('#placeDetailsContent').modal('hide');
    } else {
      setView('Novo bicicletário', '/novo');
      ga('send', 'event', 'Local', 'create - pending');

      $('#access-general-help-tooltip').off('show.bs.tooltip').on('show.bs.tooltip', () => {
        ga('send', 'event', 'Misc', 'tooltip - new pin access help');
      });
      $('#type-general-help-tooltip').off('show.bs.tooltip').on('show.bs.tooltip', () => {
        ga('send', 'event', 'Misc', 'tooltip - new pin type help');
      });
    }

    // Initialize callbacks
    $('.typeIcon').off('click.radio').on('click.radio', e => {
      $(e.currentTarget).siblings('.typeIcon').removeClass('active');
      $(e.currentTarget).addClass('active');

      // const currentStep = $(e.currentTarget).parent().data('form-step');
      // const nextStep = parseInt(currentStep) + 1;
      // const nextStepEl = $(`[data-form-step="${nextStep}"]`);
      // $('#newPlaceModal').animate({
      //   scrollTop: $(`[data-form-step="${2}"]`).offset().top
      // });

      // $('#newPlaceModal').animate({ 
      //   scrollTop: $(e.currentTarget).parent().offset().top
      // });
    });
    
    // this has to be AFTER the typeIcon click trigger
    // $('#newPlaceModal input, #newPlaceModal .typeIcon')
    //   .off('change.validate input.validate click.validate')
    //   .on(' change.validate input.validate click.validate', () => {
    //     validateNewPlaceForm();
    //   });
    // validateNewPlaceForm();
    
    $('#newPlaceModal textarea').off('keyup').on('keyup', e => {
      autoGrowTextArea(e.currentTarget); 
    });

    $('.saveNewPlaceBtn').off('click').on('click', queueUiCallback.bind(this, finishCreateOrUpdatePlace));

    // Edit only buttons
    if (openedMarker) {
      $('#cancelEditPlaceBtn').off('click').on('click', () => {
        hideAll().then(() => {
          openLocal(openedMarker);
        });
      });

      $('#editPlacePositionBtn').off('click').on('click', () => {
        // Ask to keep opened marker temporarily
        hideAll(true);
        
        map.setCenter({
          lat: parseFloat(openedMarker.lat),
          lng: parseFloat(openedMarker.lng)
        });

        // Set minimum map zoom
        if (map.getZoom() < 19) {
          map.setZoom(19);
        }
        
        toggleLocationInputMode();
      });
    }
    
    $('#photoInput').off('change').on('change', e => {
      // for some weird compiling reason using 'this' doesnt work here
      const self = document.getElementById('photoInput');
      const files = self.files ;

      if (files && files[0] && files[0].type.match(/image.*/)) {
        showSpinner('Processando imagem...');

        queueUiCallback(() => {
          let reader = new FileReader();
          reader.onload = photoUploadCB;
          reader.readAsDataURL(self.files[0]);
        });
      }// else {
      //   swal('Ops', 'Algo deu errado com a foto, por favor tente novamente.', 'error');
      // }
    });
    $('.collapsable').off('click').on('click', e => {
      $(e.currentTarget).addClass('expanded'); 
    }); 

    // Finally, display the modal
    const showModal = () => {
      // We can only set the nav title after the modal has been opened
      updatePageTitleAndMetatags(openedMarker ? 'Editar bicicletário' : 'Novo bicicletário');

      $('#newPlaceModal')
        .one('shown.bs.modal', () => {
          // $('#titleInput').focus();
        })
        .modal('show');
    };
    if (openedMarker && $('#placeDetailsModal').is(':visible')) {
      $('#placeDetailsModal')
        .one('hidden.bs.modal', () => { 
          showModal();
        })
        .modal('hide'); 
    } else {
      showModal();
    }
  }

  function getTopCities() {
    // Count how many places each city has
    let cities = {};
    markers.forEach(m => {
      if (m.city && m.state) {
        // We merge the city and state names to create a unique identifier
        const key = `${m.city},${m.state}`;
        cities[key] = cities[key] + 1 || 1;
      }
    });
    
    // Convert map into array and sort descrescently
    let citiesArray = Object.keys(cities).map(c => [c, cities[c]]);
    citiesArray.sort((a, b) => b[1] - a[1]);
    
    // Unmerge city and state
    citiesArray = citiesArray.map(c => [c[0].split(','), c[1]]);

    return citiesArray;
  }

  function deletePlace() {
    if (openedMarker) {
      swal({
        title: 'Deletar bicicletário',
        text: 'Tem certeza disso?',
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Deletar',
        confirmButtonColor: '#FF8265' 
      }).then(() => {
        ga('send', 'event', 'Local', 'delete', ''+openedMarker.id);

        showSpinner();
        
        BDB.Database.deletePlace(openedMarker.id, () => {
          goHome();
          BDB.Database.getPlaces( () => {
            BDB.Map.updateMarkers();
            hideSpinner();
            toastr['success']('Bicicletário deletado.');
          });
        });
      });
    }
  }

  function openReviewModal(prepopedRating) {
    const m = openedMarker;
    const previousReview = BDB.User.getReviewByPlaceId(m.id);
    _updatingReview = previousReview;

    // Tags toggle buttons
    let tagsButtons = tags.map(t => {
      let isPrepoped = false;
      if (previousReview && previousReview.tags && previousReview.tags.length > 0) {
        isPrepoped = previousReview.tags.find( i => parseInt(i.id) === t.id );
      }

      return `
        <button  
            class="btn btn-tag ${isPrepoped ? 'active' : ''}"
            data-toggle="button"
            data-value="${t.id}">
          ${t.name}
        </button>
      `;
    }).join(''); 

    swal({ 
      // title: 'Avaliar bicicletário',
      customClass: 'review-modal',
      html: `
        <section>
          <div class="review" {{#if pinColor}}data-color={{pinColor}}{{/if}}>
              <h2>Dê sua nota</h2>
              <fieldset class="rating">
                  <input type="radio" id="star5" name="rating" value="5" /> <label class="full-star" data-value="5" for="star5" title="De boa!"></label>
                  <input type="radio" id="star4" name="rating" value="4" /> <label class="full-star" data-value="4" for="star4" title="Bem bom"></label>
                  <input type="radio" id="star3" name="rating" value="3" /> <label class="full-star" data-value="3" for="star3" title="Médio"></label>
                  <input type="radio" id="star2" name="rating" value="2" /> <label class="full-star" data-value="2" for="star2" title="Ruim"></label>
                  <input type="radio" id="star1" name="rating" value="1" /> <label class="full-star" data-value="1" for="star1" title="Horrivel"></label>
              </fieldset>
          </div>
        </section>

        <section class="step-2">
          <h2>
            Vantagens
          </h2>
          <p class="small">Opcional. Selecione quantas achar necessário.</p>
          <div class="tagsContainer">
              ${tagsButtons}
          </div>
        </section>`,
      confirmButtonText: 'Enviar',
      confirmButtonClass: 'btn green sendReviewBtn',
      showCloseButton: true,
      showLoaderOnConfirm: true,
      onOpen: () => {
        if(!_isTouchDevice) {
          $('.review-modal .full-star').tooltip({
            toggle: 'tooltip',
            placement: 'bottom',
            'delay': {'show': 0, 'hide': 100}
          });
        }
 
        // Prepopulate rating
        if (previousReview) {
          currentPendingRating = previousReview.rating;
          $('.review-modal input[name=rating]').val([previousReview.rating]);

          ga('send', 'event', 'Review', 'update - pending', ''+m.id);
        } else if (prepopedRating) {
          currentPendingRating = prepopedRating;
          $('.review-modal input[name=rating]').val([prepopedRating]);
        } else {
          ga('send', 'event', 'Review', 'create - pending', ''+m.id);
        }

        // Init callbacks
        $('.review-modal .rating').off('change').on('change', e => {
          currentPendingRating = $(e.target).val();
          validateReviewForm();
        });

        validateReviewForm();
      },
      preConfirm: sendReviewBtnCB
    }).then( () => {
      // hideSpinner();
      if (_updatingReview) {
        ga('send', 'event', 'Review', 'update', ''+m.id, parseInt(currentPendingRating));

        toastr['success']('Avaliação atualizada.'); 
      } else {
        ga('send', 'event', 'Review', 'create', ''+m.id, parseInt(currentPendingRating));

        $('body').addClass('already-reviewed');

        // swal({ 
        //   title: 'Valeu!',
        //   html: 'Sua avaliação é muito importante! Juntos construímos a cidade que queremos.',
        //   type: 'success',
        //   onOpen: () => {
        //     startConfettis();
        //   },
        //   onClose: () => {
        //     stopConfettis();
        //     promptPWAInstallPopup();
        //   } 
        // });
        toastr['success']('Avaliação salva. Valeu!'); 
        promptPWAInstallPopup();
      }

      // Update marker data
      BDB.Database.getPlaceDetails(m.id)
        .then(updatedMarker => {
          BDB.Map.updateMarkers();
          openDetailsModal(updatedMarker);
        });
    });
  }

  function validateReviewForm() {
    const isOk = currentPendingRating;
    $('.sendReviewBtn').prop('disabled', !isOk);
    // $('.review-modal .step-2').velocity('fadeIn');
  }

  function toggleExpandModalHeader() {
    ga('send', 'event', 'Local', 'photo click', ''+openedMarker.id);

    // $('.photo-container').toggleClass('expanded');
  }

  function toggleClearLocationBtn(stateStr) {
    if (stateStr === 'show') {
      $('#clearLocationQueryBtn').addClass('clear-mode');
    } else if (stateStr === 'hide') {
      $('#clearLocationQueryBtn').removeClass('clear-mode');
    } else {
      console.error('Invalid arg in toggleClearLocationBtn()');
    }
  }

  function startConfettis() {
    window.confettiful = new Confettiful(document.querySelector('.confetti-placeholder'));
  }

  function stopConfettis() {
    clearTimeout(window.confettiful.confettiInterval);
  }

  function sendReviewBtnCB() {
    return new Promise(function (resolve, reject) {
      const m = openedMarker;

      const activeTagBtns = $('.review-modal .tagsContainer .btn.active');
      let reviewTags = [];
      for(let i=0; i<activeTagBtns.length; i++) {
        reviewTags.push( {id: ''+activeTagBtns.eq(i).data('value')} );
      }

      // showSpinner();

      const reviewObj = {
        placeId: m.id,
        rating: currentPendingRating,
        tags: reviewTags
      };

      const callback = () => {
        BDB.Database.sendReview(reviewObj, reviewId => {
          reviewObj.databaseId = reviewId;
          BDB.User.saveReview(reviewObj);

          resolve();
        });
      }; 

      const previousReview = BDB.User.getReviewByPlaceId(m.id);
      if (previousReview) {
        // Delete previous
        BDB.Database.deleteReview(previousReview.databaseId, callback);
      } else {
        callback();
      }
    });
  }

  function openRevisionDialog() {
    swal({ 
      // title: 'Sugerir correção',
      customClass: 'revision-modal',
      html:
        `<p>
          Este bicicletário está desatualizado ou está faltando uma informação importante? Nos ajude a manter o mapeamento sempre atualizado e útil pra todo mundo. :)
        </p>

        <p>
          <textarea id="revisionText" maxlength="250" onload="autoGrowTextArea(this)" 
          onkeyup="autoGrowTextArea(this)" type="text" class="text-input" placeholder="Sua sugestão"></textarea>
        </p>

        <p class="disclaimer">
          Para qualquer comentário sobre o site em geral, entre em <a class="external-link contact-btn"> <img src="/img/icon_mail.svg" class="icon-mail" /> contato</a>!
        </p>`,
      confirmButtonText: 'Enviar',
      showCloseButton: true
    }).then(() => {
      showSpinner();

      const revisionObj = {
        placeId: openedMarker.id,
        content: $('#revisionText').val()
      };

      BDB.Database.sendRevision(revisionObj, revisionId => {
        hideSpinner();
        swal('Sugestão enviada', `Obrigado por contribuir com o bike de boa! Sua sugestão será 
          avaliada pelo nosso time de colaboradores o mais rápido possível.`, 'success');
      });
    });
  }

  function getRecentSearches() {
    let recentSearches = JSON.parse(localStorage.getItem('recentSearches'));
    if (recentSearches) {
      recentSearches = recentSearches.slice(0, MAX_RECENT_SEARCHES);
    }
    
    return recentSearches;
  }

  function addToRecentSearches(searchItem) {
    let recentSearches = getRecentSearches() || [];
 
    // Remove previous occurences of the new item
    recentSearches = recentSearches.filter( r => r.name !== searchItem.name);
    
    // Add new item to the top
    recentSearches.splice(0, 0, searchItem);
    
    // Remove last item if exceeds MAX_RECENT_SEARCHES
    recentSearches.splice(MAX_RECENT_SEARCHES, 1);

    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
  } 

  function enterLocationSearchMode() {
    if ($('body').hasClass('search-mode')) {
      return;
    }

    let templateData = {};
    templateData.recentSearches = getRecentSearches();
    templateData.topCities = getTopCities().slice(0, MAX_TOP_CITIES);

    ////////////////////////////////
    // Render handlebars template //
    ////////////////////////////////
    $('#searchOverlayContentPlaceholder').html(BDB.templates.searchOverlay(templateData));

    $('.goToRecentSearchBtn').off('click').on('click', e => {
      const $target = $(e.currentTarget);
      const id = parseInt($target.data('recentsearchid'));
      const item = getRecentSearches()[id];

      map.panTo(item.pos);
      if (item.viewport) {
        map.fitBounds(item.viewport);
      } else {
        map.setZoom(17);  // Why 17? Because it looks good.
      }

      exitLocationSearchMode();
    });

    $('.openTopCitiesModal').off('click').on('click', e => {
      exitLocationSearchMode();
      setView('Principais Cidades', '/cidades-mapeadas', true);
    });

    $('.goToCityBtn').off('click').on('click', e => {
      const $target = $(e.currentTarget);
      const cityName = $target.data('cityname');

      BDB.Map.searchAndCenter(cityName) 
        .then( () => {
          exitLocationSearchMode();
        }) 
    });

    $('body').addClass('search-mode'); 
    $('#search-overlay').addClass('showThis');
    $('#search-overlay h2, #search-overlay li').velocity('transition.slideUpIn', { stagger: STAGGER_FAST, duration: 500 }); 
    $('.hamburger-button').addClass('back-mode');

    $('.hamburger-button.back-mode').one('click', () => {
      exitLocationSearchMode();
    });
  }

  function exitLocationSearchMode() {
    $('body').removeClass('search-mode');
    $('#search-overlay').removeClass('showThis');
    $('.hamburger-button').removeClass('back-mode'); 
  }

  function updatePageTitleAndMetatags(text) { 
    // Header that imitates native mobile navbar
    if (_isDeeplink && openedMarker) {
      $('#top-mobile-bar-title').text('bike de boa');
    } else {
      $('#top-mobile-bar-title').text(openedMarker ? '' : text);
    }

    text = text || 'bike de boa'; 

    // Basic website metatags
    document.title = text;
    $('meta[property="og:title"]').attr('content', text);  
    
    // Set every URL as canonical, otherwise Google thinks some are duplicates. Gotta index 'em all!
    $('link[rel="canonical"]').attr('href', window.location.href); 

    // Special metatags for Details View
    if (openedMarker) {
      // Open Graph Picture
      if (openedMarker.photo) {
        $('meta[property="og:image"]').attr('content', openedMarker.photo);
      } 

      // Dynamic description (Open Graph and others)
      if (openedMarker.address) {
        let desc = 'Veja detalhes e avaliações sobre este bicicletário na ';
        desc += openedMarker.address;

        $('meta[property="og:description"]').attr('content', desc); 
        $('meta[name="description"]').attr('content', desc); 
      }
    } else {
      $('meta[property="og:image"]').attr('content', '');
      $('meta[property="og:description"]').attr('content', '');
      $('meta[name="description"]').attr('content', ''); 
    }
 
    if (window.performance && _isDeeplink && openedMarker) {
      const timeSincePageLoad = Math.round(performance.now());
      // console.log('timeSincePageLoad', timeSincePageLoad);  
      ga('send', 'timing', 'Data', 'place deeplink metatags ready', timeSincePageLoad);
    }
  }

  function setView(title, view, isReplaceState) {
    _currentView = view;

    let data = {};
    if (title === 'bike de boa') {
      data.isHome = true;
    }

    // hideAll().then(() => {
      if (isReplaceState) {
        History.replaceState(data, title, view);
      } else {
        History.pushState(data, title, view);
      }

      // Force new pageview for Analytics
      // https://developers.google.com/analytics/devguides/collection/analyticsjs/single-page-applications
      ga('set', 'page', view);
      ga('send', 'pageview');
    // });
  }

  function goHome() {
    setView('bike de boa', '/');
  }

  function queueUiCallback(callback) {
    if (window.requestAnimationFrame) {
      requestAnimationFrame( () => {
        requestAnimationFrame( () => {
          callback();
        });
      });
    } else {
      callback();
    }
  }

  function returnToPreviousView() {
    if (_isDeeplink) {
      goHome();
    } else {
      History.back();
    }
  }

  function initGlobalCallbacks() {
    //set Map Initialization 
    $(document).on('map:ready', function () {
      hideSpinner();
      //get gMap instance to be used by functions to still referer to map here (mainly markers);
      map = BDB.Map.getMap();
      BDB.Map.updateMarkers();

      BDB.Map.showBikeLayer();
    });

    $(document).on('autocomplete:done', function (e) {
      let place = e.detail

      addToRecentSearches({
        name: place.name,
        pos: place.geometry.location,
        viewport: place.geometry.viewport
      });

      exitLocationSearchMode();

      $('#locationQueryInput').val('');
      toggleClearLocationBtn('hide');
      ga('send', 'event', 'Search', 'location', place.formatted_address);

    });

    $(document).one('LoadMap', function () {
      if (!markers) {
        showSpinner('Carregando bicicletários...'); 
      }

      BDB.Database.getPlaces( () => {
        $('#filter-results-counter').html(markers.length);
        $('#filter-results-total').html(markers.length);

        BDB.Map.updateMarkers();

        // Hide spinner that is initialized visible on CSS
        // hideSpinner();

        //
        if (_onDataReadyCallback && typeof _onDataReadyCallback === 'function') {
          _onDataReadyCallback();
          _onDataReadyCallback = null;
        }
      }); 
      BDB.Map.init(start_coords, zoom, "map", getGeolocation, openLocal); 

      if (!_isTouchDevice) {
        $('.caption-tooltip').tooltip({
          toggle: 'tooltip',
          trigger: 'hover',
          placement: 'left',
          'delay': { 'show': 0, 'hide': 0 }
        });
      }
      showUI();
    });

    $(document).on('map:outofbounds', function (result) {
      let response = result.detail;

      $('#newPlaceholder').toggleClass('invalid', !response.isCenterWithinBounds);
      $('#out-of-bounds-overlay').toggleClass('showThis', !response.isViewWithinBounds);
    });

    $('#logo').on('click', () => {
      goHome();
    });

    $('.hamburger-button').on('click', e => {
      const $target = $(e.currentTarget);
      if ($target.hasClass('back-mode')) { 
        return;
      }
      // Menu open is already triggered inside the menu component.
      ga('send', 'event', 'Misc', 'hamburger menu opened');
      setView('', '/nav');
    });
    
    $('#filterBtn').on('click', queueUiCallback.bind(this, () => {
      // Menu open is already triggered inside the menu component.
      ga('send', 'event', 'Filter', 'filter menu opened');
      setView('', '/filtros'); 
    }));

    // $('#show-bike-layer').on('change', e => {
    //   const $target = $(e.currentTarget);

    //   if ($target.is(':checked')) {
    //     ga('send', 'event', 'Filter', 'bike layer - SHOW');
    //     showBikeLayer();
    //   } else {
    //     ga('send', 'event', 'Filter', 'bike layer - HIDE');
    //     hideBikeLayer();
    //   }
    // });

    $('.facebook-social-link').on('click', () => {
      ga('send', 'event', 'Misc', 'facebook link click');
    });

    $('.instagram-social-link').on('click', () => {
      ga('send', 'event', 'Misc', 'instagram link click');
    });

    $('.github-social-link').on('click', () => {
      ga('send', 'event', 'Misc', 'github link click');
    });

    $('.medium-social-link').on('click', () => {
      ga('send', 'event', 'Misc', 'medium link click');
    });

    $('body').on('click', '.openContributionsBtn', queueUiCallback.bind(this, () => {
      hideAll();
      setView('Contribuições', '/contribuicoes', true);
    }));
 
    // SideNav has a callback that prevents click events from bubbling, so we have to target specifically its container
    $('.js-side-nav-container, body').on('click', '.open-guide-btn', queueUiCallback.bind(this, () => {
      ga('send', 'event', 'Misc', 'faq opened');
      hideAll().then(() => {
        setView('Guia de bicicletários', '/guia-de-bicicletarios', true);
      });
    }));

    // SideNav has a callback that prevents click events from bubbling, so we have to target specifically its container
    $('.js-side-nav-container, body').on('click', '.open-aboutdata-btn', queueUiCallback.bind(this, () => {
      hideAll();

      ga('send', 'event', 'Misc', 'about data opened');
      setView('Sobre nossos dados', '/sobre-nossos-dados', true);
    }));

    $('.go-to-poa').on('click', queueUiCallback.bind(this, () => {
      BDB.Map.goToCoords(DEFAULT_COORDS);
    }));

    
    $('#geolocationBtn').on('click', queueUiCallback.bind(this, () => {
      ga('send', 'event', 'Geolocation', 'geolocate button click');
      
      $('#geolocationBtn').addClass('loading');
      
      BDB.Map.getGeolocation();
      
    }));

    $(document).on('geolocation:done', function(e){
      let result = e.detail;
      $('#geolocationBtn').removeClass('loading');

      if (result.success) {
        if (result.center) {
          console.log('Geolocation init');
          ga('send', 'event', 'Geolocation', 'init', `${result.response.latitude},${result.response.longitude}`);
        }
      } else {
        console.error('Geolocation failed', result.response.message);
        ga('send', 'event', 'Geolocation', result.response.message ? `fail - ${result.response.message}`: 'fail - no_message');
  
        switch(result.response.code) {
        case 1:
          // PERMISSION_DENIED
          if (_isFacebookBrowser) {
            toastr['warning']('Seu navegador parece não suportar essa função, que pena.');
          } else {
            toastr['warning']('Seu GPS está desabilitado, ou seu navegador parece não suportar essa função.');
          }
          break; 
        case 2:
          // POSITION_UNAVAILABLE
          toastr['warning']('Não foi possível recuperar sua posição do GPS.');
          break;
        case 3:
          // TIMEOUT
          toastr['warning']('Não foi possível recuperar sua posição do GPS.');
          break;
        }
      }
    });
    
    $('#addPlace').on('click', queueUiCallback.bind(this, () => {
      // This is only available to logged users
      if (!BDB.User.isLoggedIn) {
        openLoginDialog(true);
      } else {
        // Make sure the new local modal won't think we're editing a local
        if (!$('#addPlace').hasClass('active')) {
          openedMarker = null;
        }

        ga('send', 'event', 'Local', 'toggle create pin mode');
        toggleLocationInputMode();
      }
    }));


    $('body').on('click', '.back-button', e => {
      // If was creating a new local
      // @todo Do this check better
      if (_isMobile && History.getState().title === 'Novo bicicletário') {
        swal({
          text: 'Você estava adicionando um bicicletário. Tem certeza que quer descartá-lo?',
          type: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#FF8265',
          confirmButtonText: 'Descartar', 
          allowOutsideClick: false
        }).then(() => {
          // returnToPreviousView();
          goHome();
        }
        );
      } else {
        // returnToPreviousView();
        goHome();
      }
    });

        
    /////////////////////
    // Modal callbacks //
    /////////////////////

    $('body').on('click', '.modal, .close-modal', e => {
      // If click wasn't on the close button or in the backdrop, but in any other part of the modal
      if (e.target != e.currentTarget) {
        return;
      }

      goHome();
    });

    $('body').on('show.bs.modal', '.modal', e => {
      // Replace bootstrap modal animation with Velocity.js
      $('.modal-dialog')
        .velocity((_isMobile ? 'transition.slideRightIn' : 'transition.slideDownIn'), {duration: MODAL_TRANSITION_IN_DURATION})
        .velocity({display: 'table-cell'});

      const openingModalEl = $(e.currentTarget);

      // Set mobile navbar with modal's title
      const openingModalTitle = openingModalEl.find('.view-name').text();
      updatePageTitleAndMetatags(openingModalTitle);

      $('body').addClass(openingModalEl.attr('id'));

      // Mobile optimizations
      if (_isMobile) {
        // $('#map, #addPlace, #geolocationBtn').addClass('optimized-hidden');
      } else {
        hideUI();

        if (openingModalEl.hasClass('clean-modal')) {
          $('body').addClass('clean-modal-open');
        }
      }
    });

    $('body').on('hide.bs.modal', '.modal', e => {
      const closingModalEl = $(e.currentTarget);

      updatePageTitleAndMetatags();
      
      $('body').removeClass(closingModalEl.attr('id'));

      if (_isMobile) { 
        // $('#map, #addPlace, #geolocationBtn').removeClass('optimized-hidden');
        $('body').removeClass('transparent-mobile-topbar');

        // Fix thanks to https://stackoverflow.com/questions/4064275/how-to-deal-with-google-map-inside-of-a-hidden-div-updated-picture
        if (map) {
          google.maps.event.trigger(map, 'resize');
          map.setCenter(map.getCenter());
        }
      } else {
        showUI();
        
        $('body').removeClass('clean-modal-open');
      }
    }); 
    

    /////////////////////
    // Location Search //
    /////////////////////

    $('#locationQueryInput').on('focus', e => { 
      if ($('#locationQueryInput').val().length === 0) {
        enterLocationSearchMode();
      }
    });
    if (!_isMobile) {
      // Hide our panel if the user clicked anywhere outside
      $('#locationQueryInput').on('blur', e => { 
        exitLocationSearchMode();
      });
       
      // Hide our panel if the Google Autocomplete panel is opened
      $('#locationQueryInput').on('input change paste', e => {
        if ($('#locationQueryInput').val().length > 0) {
          exitLocationSearchMode(); 
        } else { 
          enterLocationSearchMode();
        }
      });
    }

    $('#locationQueryInput').on('input change paste', queueUiCallback.bind(this, () => {
      toggleClearLocationBtn($('#locationQueryInput').val().length > 0 ? 'show' : 'hide');
    }));

    $('#clearLocationQueryBtn').on('click', queueUiCallback.bind(this, () => {
      $('#locationQueryInput').val('');
      toggleClearLocationBtn('hide');
      // _searchResultMarker.setVisible(false);
    }));
  }

  function hideAll(keepOpenedMarker) {
    return new Promise( (resolve, reject) => {
      // Close any sidenavs
      if (_hamburgerMenu && _filterMenu) {
        _hamburgerMenu.hide({dontMessWithState: false});
        _filterMenu.hide({dontMessWithState: false});
      }

      const openLightbox = $.featherlight.current();
      if (openLightbox) {
        openLightbox.close();
      }

      // @todo explain this hack plz
      if (!keepOpenedMarker) {
        openedMarker = null;
      }

      const $visibleModals = $('.modal').filter(':visible');
      if ($visibleModals.length > 0) {
        $visibleModals
          .one('hidden.bs.modal', resolve)
          .modal('hide');
      } else {
        resolve();
      }
    });
  }

  function promptPWAInstallPopup() { 
    // Deferred prompt handling based on:
    //   https://developers.google.com/web/fundamentals/engage-and-retain/app-install-banners/
    if (_deferredPWAPrompt !== undefined) {
      // The user has had a postive interaction with our app and Chrome
      // has tried to prompt previously, so let's show the prompt.
      _deferredPWAPrompt.prompt(); 

      ga('send', 'event', 'Misc', 'beforeinstallprompt - popped');
      e.userChoice.then(function(choiceResult) {
        // console.log(choiceResult.outcome); 
        if(choiceResult.outcome == 'dismissed') {
          // User cancelled home screen install
          ga('send', 'event', 'Misc', 'beforeinstallprompt - refused');
        }
        else {
          // User added to home screen
          ga('send', 'event', 'Misc', 'beforeinstallprompt - accepted');
        }
      });

      _deferredPWAPrompt = false;

      return true;
    } else {
      return false;
    }
  }

  function openHowToInstallModal() {
    // const hasNativePromptWorked = promptPWAInstallPopup(); 

    // if (!hasNativePromptWorked) {
    if (_isMobile) { 
      // Tries to guess the user agent to initialize the correspondent accordion item opened
      const userAgent = window.getBrowserName();
      switch (userAgent) {
      case 'Chrome':
        $('#collapse-chrome').addClass('in');
        break;
      case 'Firefox':
        $('#collapse-firefox').addClass('in');
        break;
      case 'Safari':
        $('#collapse-safari').addClass('in');
        break;
      }
    }

    if ($('#howToInstallModal').length === 0) {
      $('body').append(BDB.templates.howToInstallModal());
    }

    // Lazy load gifs when modal is shown
    // $('#howToInstallModal .tutorial-gif').each((i, v) => {
    //   $(v).attr('src', $(v).data('src'));
    // });

    $('#howToInstallModal').modal('show');

    $('#howToInstallModal article > *').css({opacity: 0}).velocity('transition.slideDownIn', { stagger: STAGGER_NORMAL });
    // }
  }

  function openFaqModal() { 
    if ($('#faqModal').length === 0) {
      $('body').append(BDB.templates.faqModal());
    }

    $('#faqModal').modal('show');
    $('#faqModal .panel').css({opacity: 0}).velocity('transition.slideDownIn', { stagger: STAGGER_NORMAL });

    $('#faq-accordion').off('show.bs.collapse').on('show.bs.collapse', e => {
      const questionTitle = $(e.target).parent().find('.panel-title').text();
      ga('send', 'event', 'FAQ', 'question opened', questionTitle);
    });
  }

  function openTopCitiesModal() { 
    if ($('#topCitiesModal').length === 0) {
      let templateData = {};
      templateData.topCities = getTopCities();
      
      $('body').append(BDB.templates.topCitiesModal(templateData));
    }

    $('#topCitiesModal').modal('show');
    $('#topCitiesModal .panel').css({opacity: 0}).velocity('transition.slideDownIn', { stagger: STAGGER_NORMAL });

    $('.goToCityBtn').off('click').on('click', e => {
      const $target = $(e.currentTarget);
      const cityName = $target.data('cityname');

      $('#topCitiesModal').modal('hide');
      BDB.Map.searchAndCenter(cityName) 
        .then(() => {
          goHome(); 
          exitLocationSearchMode();
        })
    });
  }

  function openContributionsModal() { 
    let templateData = {};
    templateData.profile = BDB.User.profile;
    templateData.isAdmin = BDB.User.isAdmin;
    templateData.reviews = BDB.User.reviews;
    templateData.places = BDB.User.places;

    // Reviews list
    if (templateData.reviews) {
      templateData.nreviews = templateData.reviews.length;

      for(let i=0; i < templateData.reviews.length; i++) {
        let r = templateData.reviews[i];
        
        // Created X days ago
        if (r.createdAt) {
          r.createdTimeAgo = createdAtToDaysAgo(r.createdAt);
        }

        let stars = '';
        for (let s=0; s < r.rating; s++) {
          stars += '<span class="glyphicon glyphicon-star"></span>';
        }
        r.ratingContent = r.rating + ' ' + stars;  

        r.color = getColorFromAverage(r.rating);
      }
 
      templateData.reviews = templateData.reviews.sort( (a,b) => new Date(b.createdAt) - new Date(a.createdAt) );
    }

    // Places list
    if (templateData.places) {
      templateData.nplaces = templateData.places.length;

      for(let i=0; i < templateData.places.length; i++) {
        let p = templateData.places[i];
        // Created X days ago
        if (p.createdAt) {
          p.createdTimeAgo = createdAtToDaysAgo(p.createdAt);
        }
      }
      
      templateData.places = templateData.places.sort( (a,b) => new Date(b.createdAt) - new Date(a.createdAt) );
    }

    ////////////////////////////////
    // Render handlebars template //
    ////////////////////////////////
    $('#modalPlaceholder').html(BDB.templates.contributionsModal(templateData));
    $('#contributionsModal').modal('show');

    $('.go-to-place-btn').off('click').on('click', e => {
      const $target = $(e.currentTarget);
      const id = $target.data('id');
      const place = BDB.Places.getMarkerById(id);

      $('#contributionsModal')
        .one('hidden.bs.modal', () => {
          openLocal(place);
        })
        .modal('hide');
    });
  }

  function openGuideModal() {
    if ($('#guideModal').length === 0) {
      $('body').append(BDB.templates.guideModal());
    }

    $('#guideModal').modal('show');
    $('#guideModal article > *').css({opacity: 0}).velocity('transition.slideDownIn', { stagger: STAGGER_NORMAL });

    // Lazy load gifs when modal is shown
    $('#guideModal .guide-img-row img').each( (i, v) => {
      $(v).attr('src', $(v).data('src'));
    });

    $('#guideModal .close-and-filter').off('click').on('click', function() {
      const p = $(this).data('prop');
      const v = $(this).data('value'); 

      // Close modal
      goHome();

      // Mark corresponding filter checkbox
      $('.filter-checkbox').prop('checked', false);
      $(`.filter-checkbox[data-prop="${p}"][data-value="${v}"`).prop('checked', true);
      updateFilters();
    });
  } 

  function openNotFoundModal(url){
    toastr['warning']('Que pena, parece que o link não foi encontrado. <br/> Mas você pode encontrar um bicletário pertinho de você! <br/>Da uma olhada!');
    ga('send', 'event', 'Misc', 'router - 404 Not Found', url);
    //to do: Rethink this:
    $(document).trigger('LoadMap');
  }
  function openDataModal() {
    if ($('#dataModal').length === 0) {
      $('body').append(BDB.templates.dataModal()); 
    }

    $('#dataModal').modal('show');
    $('#dataModal article > *').css({opacity: 0}).velocity('transition.slideDownIn', { stagger: STAGGER_NORMAL });
  } 

  function openAboutModal() {
    if ($('#aboutModal').length === 0) {
      $('body').append(BDB.templates.aboutModal());
    }

    // Lazy load images when modal is shown
    $('#aboutModal img').each((i, v) => {
      $(v).attr('src', $(v).data('src'));
    });

    $('#aboutModal').modal('show');
    $('#aboutModal article > *').css({opacity: 0}).velocity('transition.slideDownIn', { stagger: STAGGER_NORMAL });

    BDB.Database.customAPICall('get', 'stats')
      .then(data => {
        $('#about-stats--places').velocity('fadeIn').text(data.localsCount);
        $('#about-stats--reviews').velocity('fadeIn').text(data.reviewsCount);
        $('#about-stats--views').velocity('fadeIn').text(data.viewsCount);
      });

    // if (markers) {
    //   $('#about-stats--places').data('countupto', markers.length);
    //   // $('#about-stats--nviews').text(markers.reduce( (a,b) => a.views + b.views, 0));
    // }

    // $('[data-countupto]').each( function(i, val) {
    //   new CountUp(this.id, 0, this.data('countupto')).start();
    // });  
    // new CountUp("about-stats--places", 0, $('#about-stats--places').data('countupto'), 0, 5).start();
    // new CountUp("about-stats--reviews", 0, $('#about-stats--reviews').data('countupto'), 0, 5).start();
    // new CountUp("about-stats--views", 0, $('#about-stats--views').data('countupto'), 0, 5).start();
  }

  function handleRouting(initialRouting = false) { 
    const urlBreakdown = window.location.pathname.split('/');
    let match = urlBreakdown[1];

    // Routes that on initial loading should be redirected to the Home
    if (initialRouting) {
      switch(urlBreakdown[1]) {
      case 'novo':
      case 'editar':
      case 'nav':
      case 'filtros':
      case 'foto':
        window.location.pathname = '';
        break;
      }
    }

    switch (urlBreakdown[1]) {
    case 'b':
      if (urlBreakdown[2] && urlBreakdown[2]!=='foto') {
        let id = urlBreakdown[2].split('-')[0];
        if (id) {
          id = parseInt(id);

          if (initialRouting) {
            _isDeeplink = true;
            $('body').addClass('deeplink');

            // showSpinner();

            // Center the map on pin's position
            if (map && _deeplinkMarker) {
              map.setZoom(18);
              map.setCenter({
                lat: parseFloat(_deeplinkMarker.lat),
                lng: parseFloat(_deeplinkMarker.lng)
              });
            }
          }

          if (_isDeeplink) { 
            routerOpenDeeplinkMarker(id, () => {
              // Delay loading of background map for maximum optimized startup
              //change here.
              if (_deeplinkMarker){
                let coords = {
                  latitude : parseFloat(_deeplinkMarker.lat),
                  longitude: parseFloat(_deeplinkMarker.lng)
                }
                start_coords = coords;  
                zoom = 17;
                getGeolocation = false;
              }  
              if (!_isMobile) {
                $(document).trigger('LoadMap');
              }
            });
          } else {
            routerOpenLocal(id);
          }
        } else {
          // 404 code. 
          openNotFoundModal(match);
          match = false;
        }
      }
      break;
    case 'faq':
      openFaqModal();
      break;
    case 'como-instalar':
      openHowToInstallModal();
      break;
    case 'guia-de-bicicletarios':
      openGuideModal();
      break;
    case 'sobre':
      openAboutModal();
      break;
    case 'sobre-nossos-dados':
      openDataModal();
      break;
    case 'contribuicoes':
      hideAll();
      openContributionsModal();
      break;
    case 'nav':
      _hamburgerMenu.show();
      break;
    case 'filtros':
      _filterMenu.show();
      break;
    case 'cidades-mapeadas':
      openTopCitiesModal(); 
      break;
    case 'novo' :
    case 'editar':
    case 'foto':
    case 'dados':
      break;
    case '':
      if (!map && !_isOffline) {
        $(document).trigger('LoadMap');
        //BDB.Map.updateMarkers();
      }
 
      if (_isDeeplink) {
        // $('#map').removeClass('mock-map');
        // $('#logo').removeClass('clickable');
        $('body').removeClass('deeplink');
        _isDeeplink = false;
      }

      hideAll();
      break;
    default:
      openNotFoundModal(match);
      match = false; 
      break;
    }

    if (match && initialRouting) {
      _isDeeplink = true;
      $('body').addClass('deeplink');       
    }
    return match;
  }

  function openLoginDialog(showPermissionDisclaimer = false) {
    // let permissionDisclaimer = '';
    // if (showPermissionDisclaimer) {
    //   permissionDisclaimer = `
    //     <p>
    //       Você precisa estar logado pra fazer isso. Esta é a melhor forma de garantirmos a qualidade do mapeamento. :)
    //     </p>
    //   `;
    // }

    // Returns the dialog promise
    return swal({ 
      title: showPermissionDisclaimer ? 'Você precisa fazer login' : 'Login', 
      html: `
        <br> 
 
        <p>
          Fazendo login você pode acessar todas contribuições que já fez e adicionar novos bicicletários no mapa.
        </p>

        <div>
          <button class="customLoginBtn facebookLoginBtn">
            Facebook
          </button>
        </div>

        <div>
          <button class="customLoginBtn googleLoginBtn">
            Google
          </button>
        </div>

        <br>

        <p style="
          font-style: italic;
          font-size: 12px;
          text-align: center;
          max-width: 300px;
          margin: 0 auto;">
          Nós <b>jamais</b> iremos vender os seus dados, mandar spam ou postar no seu nome sem sua autorização.
        </p>
        `,
      showCloseButton: true,
      showConfirmButton: false,
      onOpen: () => {
        window._isLoginDialogOpened = true;
      }
    });
  }

  function onSocialLogin(auth) {
    console.debug('auth', auth);

    // Dont add this unnecessary visual noise if on mobile
    if (!_isMobile) {
      $('#userBtn').addClass('loading');
    }

    if (window._isLoginDialogOpened) {
      swal.close(); 
      window._isLoginDialogOpened = false;
    }

    // Save the social token
    _socialToken = auth.authResponse.access_token;

    // Get user information for the given network
    hello(auth.network).api('me').then(function(profile) { 
      console.debug('profile', profile);

      BDB.Database.socialLogin({
        network: auth.network,
        socialToken: _socialToken,
        fullname: profile.name,
        email: profile.email 
      }).then( data => { 
        promptPWAInstallPopup();

        // UI
        $('#topbarLoginBtn').css('visibility','hidden'); 
        $('#userBtn').show();
        $('#userBtn .userBtn--user-name').text(profile.first_name);
        $('#userBtn').removeClass('loading');
        $('#userBtn .avatar').attr('src', profile.thumbnail);
        // $('.openContributionsBtn, .openProfileDivider').show();
        $('#userBtn .openContributionsBtn').attr('disabled', false);
        $('#userBtn .logoutBtn').show(); 
        $('#userBtn .loginBtn').hide();
        if (data.role === 'admin') {
          $('#userBtn').addClass('admin');
          profile.isAdmin = true;
        } else {
          profile.isAdmin = false;
        }
        
        profile.role = data.role;
        profile.isNewUser = data.isNewUser;
        
        BDB.User.login(profile); 

        document.dispatchEvent(new CustomEvent('bikedeboa.login'));
      }).catch( error => {
        console.error('Error on social login', error); 
        toastr['warning']('Alguma coisa deu errado no login :/ Se continuar assim por favor nos avise!');

        $('#userBtn').removeClass('loading');
      });
    });
  }

  function onSocialLogout() {
    BDB.User.logout();

    // UI
    if (!_isMobile){
      $('#userBtn').hide();  
    }
    $('#userBtn .avatar').attr('src', $("#userBtn .avatar").data('src'));
    $('#topbarLoginBtn').css('visibility','visible');
    $('#userBtn').removeClass('admin');
    $('#userBtn .userBtn--user-name').text('');
    $('.logoutBtn').hide();
    $('.loginBtn').show(); 
    $('.openContributionsBtn').attr('disabled', true);

    document.dispatchEvent(new CustomEvent('bikedeboa.logout'));
  }

  function openWelcomeMessage() { 
    // setTimeout( () => {
    //   if (_isMobile) {
    //     $('.welcome-message-container').show();  
    //   } else {
    //     $('.welcome-message-container').velocity('fadeIn', { duration: 3000 }); 
    //   }
    // }, 2000);

    if (_isMobile) {
      return;
    }

    ga('send', 'event', 'Misc', 'welcome message - show');
     
    // $('.welcome-message-container').show(); 
    $('.welcome-message').velocity('transition.slideUpIn', {delay: 1000, duration: 1600});  

    $('.welcome-message-container .welcome-message--close').on('click', () => {
      $('.welcome-message').velocity('transition.slideDownOut'); 
      // $('.welcome-message-container').remove();
      BDB.Session.setWelcomeMessageViewed(); 

      ga('send', 'event', 'Misc', 'welcome message - closed');
    });

    $('.welcome-message-container a').on('click', () => {
      $('.welcome-message-container').remove();
      BDB.Session.setWelcomeMessageViewed(); 

      ga('send', 'event', 'Misc', 'welcome message - link click');
    });
  }

  function init() {
    // Retrieve markers saved in a past access
    markers = BDB.getMarkersFromLocalStorage();
    
    if (markers && markers.length) {
      console.debug(`Retrieved ${markers.length} locations from LocalStorage.`);
      //hideSpinner();
    }

    if (!_isOffline) {
      // Use external service to get user's IP
      $.getJSON('//ipinfo.io/json', data => {
        if (data && data.ip) {
          ga('send', 'event', 'Misc', 'IP retrival OK', ''+data.ip);
          BDB.Database._setOriginHeader(data.ip);
        } else {
          console.error('Something went wrong when trying to retrieve user IP.');
          ga('send', 'event', 'Misc', 'IP retrieval error');
        }
      });

      handleRouting(true);

      let attemptsLeft = MAX_AUTHENTICATION_ATTEMPTS;
      const onFail = () => {
        attemptsLeft--;
        if (attemptsLeft > 0) {
          console.error(`Authentication failed, ${attemptsLeft} attempts left. Trying again in 2s...`);
          setTimeout(() => {
            BDB.Database.authenticate().catch(onFail);
          }, 2000);
        } else {
          // Failed after multiple attemps: we're officialy offline!
          setOfflineMode();
        }
      }
      BDB.Database.authenticate()
        .catch(onFail);
      BDB.Database.getAllTags();
    }

    // Got Google Maps, either we're online or the SDK is in cache.
    // if (window.google) {
    // On Mobile we defer the initialization of the map if we're in deeplink
    // if (!_isMobile || (_isMobile && window.location.pathname === '/')) {
    //   $(document).trigger('LoadMap');
    // }
    // } else {
    //   if (window.location.pathname !== '/dados') {
    //     setOfflineMode();
    //   }
    // }
  } 

  function setOfflineMode() {
    _forceOffline = true;
    updateOnlineStatus();
  }

  function updateOnlineStatus(e) {
    if (!_forceOffline) {
      _isOffline = !navigator.onLine;
    } else {
      _isOffline = true; 
      _forceOffline = null;
    }

    if (_isOffline) {
      $('body').addClass('offline');
  
      if (BDB.Map.getMap()) {
        // toastr['info']('Mas fica à vontade, os bicicletários da última vez que você acessou estão salvos.', 'Você está offline');
        // toastr['info']('Mas fica à vontade, você pode continuar usando o bike de boa.', 'Você está offline');
        toastr['info']('Você está offline');
      } else {
        $('#offline-overlay').addClass('showThis');

        $('#geolocationBtn').hide();
        
        $('#reloadBtn').on('click', () => {
          showSpinner()
            .then(() => {
              window.location.reload();
            });
        });
      }
    } else if (_isOffline === false) { 
      $('body').removeClass('offline');
      $('#offline-overlay').removeClass('showThis');
    }

  }

  function initNavCallbacks() {
    $('.loginBtn').on('click', queueUiCallback.bind(this, () => {
      // @todo having to call these two ones here is bizarre
      hideAll();
      goHome();

      // setView('Login Administrador', '/login', true);
      // login(true);

      openLoginDialog();
    })); 

    $('.openAboutBtn').on('click', queueUiCallback.bind(this, () => {
      hideAll();
      ga('send', 'event', 'Misc', 'about opened');
      setView('Sobre', '/sobre', true);
    }));

    $('body').on('click', '.facebookLoginBtn', () => {
      hideAll();
      hello('facebook').login({ scope: 'email' });
    });

    $('body').on('click', '.googleLoginBtn', () => {
      hideAll();
      hello('google').login({ scope: 'email' });
    });

    $('body').on('click', '.logoutBtn', () => {
      hideAll();
      hello.logout('facebook');
      hello.logout('google');
    });

    $('.howToInstallBtn').on('click', queueUiCallback.bind(this, () => {
      hideAll();

      ga('send', 'event', 'Misc', 'how-to-install opened');
      setView('Como instalar o app', '/como-instalar', true);
    }));

    $('.open-faq-btn').on('click', queueUiCallback.bind(this, () => {
      hideAll();

      ga('send', 'event', 'Misc', 'faq opened');
      setView('Perguntas frequentes', '/faq', true);
    }));

    $('.contact-btn').on('click', queueUiCallback.bind(this, () => {
      // @todo having to call these two ones here is bizarre
      hideAll();
      goHome();

      ga('send', 'event', 'Misc', 'contact opened');

      swal({
        title: 'Contato',
        html:
          `
            <div style="text-align: center; font-size: 30px;">
              <p>
                <a class="" target="_blank" rel="noopener" href="https://www.facebook.com/bikedeboaapp">
                  <img alt="" class="svg-icon" src="/img/icon_social_facebook.svg"/>
                </a> 

                <a class="" target="_blank" rel="noopener" href="https://www.instagram.com/bikedeboa/">
                  <img alt="" class="svg-icon" src="/img/icon_social_instagram.svg"/>
                </a>

                <a class="" target="_blank" rel="noopener" href="https://medium.com/bike-de-boa/">
                  <img alt="" class="svg-icon" src="/img/icon_social_medium.svg"/>
                </a>

                <a class="" target="_blank" rel="noopener" href="https://github.com/cmdalbem/bikedeboa">
                  <img alt="" class="svg-icon" src="/img/icon_social_github.svg"/>
                </a>

                <a href="mailto:bikedeboa@gmail.com">
                  <img alt="" class="svg-icon" src="/img/icon_mail.svg"/>
                </a>
              </p>
            </div> 

            <hr>

            <h2 class="swal2-title" id="swal2-title">Feedback</h2>
            <div style="text-align: center;">
              Queremos saber o que você está achando! Tem 5 minutinhos? Responda <a class="external-link" target="_blank" rel="noopener" href="https://docs.google.com/forms/d/e/1FAIpQLSe3Utw0POwihH1nvln2JOGG_vuWiGQLHp6sS0DP1jnHl2Mb2w/viewform?usp=sf_link">nossa pesquisa</a>.
            </div>
          `,
      });
    }));
  }

  function initMenus() {
    const sidenavHideCallback = () => {
      // @todo explain this
      setView('bike de boa', '/', true);
    };

    // Delay loading of those to optimize startup
    if (_isMobile) {
      $('body').append(BDB.templates.hamburgerMenu());

      _hamburgerMenu = new SideNav(
        'hamburger-menu',
        {
          hideCallback: sidenavHideCallback
        }
      );
    } else {
      $('body').append(BDB.templates.filterMenu());

      $('#clear-filters-btn').on('click', () => {
        $('.filter-checkbox:checked').prop('checked', false);

        ga('send', 'event', 'Filter', 'clear filters');

        updateFilters();
      });

      $('.filter-checkbox').on('change', e => {
        // ga('send', 'event', 'Misc', 'launched with display=standalone');
        const $target = $(e.currentTarget);

        ga('send', 'event', 'Filter', `${$target.data('prop')} ${$target.data('value')} ${$target.is(':checked') ? 'ON' : 'OFF'}`);

        queueUiCallback(updateFilters);
      }); 
       
      _filterMenu = new SideNav(
        'filter-menu',
        {
          inverted: true,
          hideCallback: sidenavHideCallback
          /*fixed: true*/
        }
      );
    }
 
    initGlobalCallbacks();
    initNavCallbacks();
  }

  // Setup must only be called *once*, differently than init() that may be called to reset the app state.
  function setup() {
    // Detect if webapp was launched from mobile homescreen (for Android and iOS)
    // References:
    //   https://developers.google.com/web/updates/2015/10/display-mode
    //   https://stackoverflow.com/questions/21125337/how-to-detect-if-web-app-running-standalone-on-chrome-mobile
    if (navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
      $('body').addClass('pwa-installed');
      ga('send', 'event', 'Misc', 'launched with display=standalone');
    }

    // Check if it's the Native App version
    if (window.navigator.userAgent.indexOf('BikeDeBoaApp') > 0) {
      $('body').addClass('webview-app');
      ga('send', 'event', 'Misc', 'launched from native app'); 
    }

    // Online Status
    // updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const isMobileListener = window.matchMedia('(max-width: ${MOBILE_MAX_WIDTH})');
    isMobileListener.addListener((isMobileListener) => {
      _isMobile = isMobileListener.matches;
    });
    
    // Super specific mobile stuff
    if (_isMobile) {
      // Optimized short placeholder
      $('#locationQueryInput').attr('placeholder','Buscar endereço');

      // Remove Bootstrap fade class
      $('.modal').removeClass('fade');
    } else {
      $('#locationQueryInput').attr('placeholder','Buscar endereço ou estabelecimento');
    }

    // User is within Facebook browser.
    // thanks to: https://stackoverflow.com/questions/31569518/how-to-detect-facebook-in-app-browser
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    _isFacebookBrowser = (userAgent.indexOf('FBAN') > -1) || (userAgent.indexOf('FBAV') > -1);

    initMenus();

    // Bind trigger for history changes
    History.Adapter.bind(window, 'statechange', () => {
      const state = History.getState();
      
      // Always close any open dialog if a navigation is triggered 
      swal.close();

      if (_isFeatherlightOpen) {
        const openLightbox = $.featherlight.current();
        if (openLightbox) {
          openLightbox.close();
        }
        _isFeatherlightOpen = false;
      }

      handleRouting();
    });

    // Initialize router
    _onDataReadyCallback = () => {
      if (window.performance && !_isDeeplink) {
        const timeSincePageLoad = Math.round(performance.now());
        ga('send', 'timing', 'Data', 'data ready', timeSincePageLoad);
      }

      // Not used anymore (for now?)
      // if (_routePendingData) {
      //   handleRouting();
      // }

      BDB.User.init();       

      if (!_isDeeplink && !BDB.Session.hasUserSeenWelcomeMessage()) {
        openWelcomeMessage();
      }
    };

    // Set up SweetAlert, the alert window lib
    swal.setDefaults({
      confirmButtonColor: '#30bb6a',
      confirmButtonText: 'OK',
      confirmButtonClass: 'btn',
      cancelButtonText: 'Cancelar',
      cancelButtonClass: 'btn',
      buttonsStyling: false,
      allowOutsideClick: true,
      animation: true 
    });

    // Set up Featherlight - photo lightbox lib
    if ($.featherlight) {
      // Extension to show the img alt tag as a caption within the image
      $.featherlight.prototype.afterContent = function() { 
        var caption = this.$currentTarget.find('img').attr('alt');
        this.$instance.find('.caption').remove();
        $('<div class="featherlight-caption">').text(caption).appendTo(this.$instance.find('.featherlight-content'));
      };
      $.featherlight.prototype.beforeOpen = function() { 
        History.pushState(null, null, 'foto');
        _isFeatherlightOpen = true; 
      };
      $.featherlight.defaults.closeOnEsc = false;
    }
 
    // Set up Toastr, the messaging lib
    toastr.options = {
      // 'positionClass': _isMobile ? 'toast-bottom-center' : 'toast-bottom-left',
      'positionClass': 'toast-bottom-center',
      'closeButton': false,
      'progressBar': false
    };

    // Set up Hello.js, the Social Login lib
    hello.init({
      facebook: FACEBOOK_CLIENT_ID,
      google: GOOGLE_CLIENT_ID, 
        // windows: WINDOWS_CLIENT_ID,
    },{
      // redirect_uri: window.location.origin
      redirect_uri: '/redirect.html'
    });
    hello.on('auth.login', auth => {
      // Hack to fix what I think is the bug that was causing duplicate user entries
      if (!_loginMutexBlocked) {
        onSocialLogin(auth);
        _loginMutexBlocked = true;
        setTimeout(() => { 
          _loginMutexBlocked = false;
        }, 1500);
      } else {
        // block! 
        console.debug('login called again in 1500ms window!');
        ga('send', 'event', 'Login', 'mutex-blocked: login called again in a 1500ms window');
      }
    });
    hello.on('auth.logout', () => {
      onSocialLogout(); 
    });

    // Initialize all help tooltips
    initHelpTooltip('#filter-menu .help-tooltip-trigger');

    // Temporarily in disuse
    // $('#ciclovias-help-tooltip').off('show.bs.tooltip').on('show.bs.tooltip', () => {
    //   ga('send', 'event', 'Misc', 'tooltip - ciclovias');
    // });

    // Intercepts Progressive Web App event
    // source: https://developers.google.com/web/fundamentals/engage-and-retain/app-install-banners/
    // window.addEventListener('beforeinstallprompt', e => {
    //   e.preventDefault();
    //   _deferredPWAPrompt = e;
    
    //   $('.howToInstallBtn').css({'font-weight': 'bold'});
    
    //   return false;
    // });
  }


  //////////////////////////
  // Start initialization //
  //////////////////////////

  // Things that are only done once per app
  setup(); 

  // Things that can be redone
  init();
});
