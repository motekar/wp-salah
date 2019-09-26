'use strict'

var WP_Salah = {};

(function ($) {
  $(document).ready(function () {
    WP_Salah.initPrayerTime()
    setInterval(function () {
      WP_Salah.timerUpdate()
    }, 1000)
  })

  WP_Salah.createCookie = function (name, value, hours) {
    var expires = ''
    if (hours) {
      var date = new Date()
      date.setTime(date.getTime() + (hours * 60 * 60 * 1000))
      expires = '; expires=' + date.toGMTString()
    }
    document.cookie = name + '=' + value + expires + '; path=/'
  }

  WP_Salah.readCookie = function (name) {
    var nameEQ = name + '='
    var ca = document.cookie.split(';')
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i]
      while (c.charAt(0) === ' ') c = c.substring(1, c.length)
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length)
    }
    return null
  }

  WP_Salah.eraseCookie = function (name) {
    WP_Salah.createCookie(name, '', -1)
  }

  WP_Salah.changePrayerTime = function (locationData) {
    $('.js-wp-salah-change-city .city-name').html('...')
    $('.js-wp-salah-time').html('...')
      .parents('tr').removeClass('-active')

    // to be used by map location selector
    WP_Salah.prayerTimes = locationData

    // store info without time limit
    WP_Salah.createCookie('slh_loc', encodeURIComponent(locationData.loc))
    WP_Salah.createCookie('slh_cty', locationData.city)

    var tzURL = 'https://maps.googleapis.com/maps/api/timezone/json?key=' + wp_salah_config.keys.google + '&timestamp=0&location='
    var tzURL2 = 'http://api.timezonedb.com/v2.1/get-time-zone?key=' + wp_salah_config.keys.tzdb + '&by=position&format=json'

    // // load timezone data from google API
    // $.getJSON(tzURL + locationData.loc, function(tzData) {

    // load timezone data from timezonedb API
    var lat = locationData.loc.split(',')[0]
    var lng = locationData.loc.split(',')[1]
    $.getJSON(tzURL2 + '&lat=' + lat + '&lng=' + lng, function (tzData) {
      // window.tzData = tzData; // debug

      var prayerParams = {
        action: 'wp_salah_time',
        location: locationData.loc
      }

      if (tzData.rawOffset) { // google data
        prayerParams.rawOffset = tzData.rawOffset
        WP_Salah.createCookie('slh_zon', tzData.rawOffset)
        WP_Salah.prayerTimes.offset = tzData.rawOffset
      } else if (tzData.gmtOffset) { // timezonedb.com
        prayerParams.rawOffset = tzData.gmtOffset
        WP_Salah.createCookie('slh_zon', tzData.gmtOffset)
        WP_Salah.prayerTimes.offset = tzData.gmtOffset
      } else {
        WP_Salah.eraseCookie('slh_zon')
      }

      // load prayer time from ajax
      $.post(wp_salah_config.ajaxurl, prayerParams).success(function (response) {
        var cityName = typeof locationData.city === 'string' ? locationData.city.replace(' ', '&nbsp;') : 'N/A'

        $('.js-wp-salah-change-city .city-name').html(cityName)

        var slhTimes = []

        $.each(response.time, function (name, value) {
          if (!$('#prayer-number-' + name).length) { return }

          $('#prayer-number-' + name).html(value)
          slhTimes.push(value)
        })

        // simpan waktu terbit
        slhTimes.push(response.time.terbit)

        // cache data in cookie
        WP_Salah.createCookie('slh_tms', slhTimes.join(','), 12)
        WP_Salah.prayerTimes.times = slhTimes.join(',')

        WP_Salah.timerUpdate()
      })
    })
  }

  WP_Salah.changePrayerTimeByCookie = function () {
    var cookieCity = WP_Salah.readCookie('slh_cty')

    if (!cookieCity) return false

    WP_Salah.prayerTimes = {
      city: cookieCity,
      loc: decodeURIComponent(WP_Salah.readCookie('slh_loc')),
      offset: WP_Salah.readCookie('slh_zon')
    }

    $('.js-wp-salah-change-city .city-name').html(cookieCity.replace(' ', '&nbsp;'))

    var slhTimes = WP_Salah.readCookie('slh_tms')

    // check if slhTimes cookie expired
    if (!slhTimes) {
      WP_Salah.changePrayerTime(WP_Salah.prayerTimes)
    } else {
      WP_Salah.prayerTimes.times = slhTimes
      slhTimes = slhTimes.split(',')
      $('.js-wp-salah-time').each(function (index) {
        $(this).html(slhTimes[index])
      })

      // trigger highlighting
      WP_Salah.timerUpdate()
    }

    return true
  }

  WP_Salah._parseGoogleCityName = function (data) {
    var country = data[data.length - 1].formatted_address

    var city = 'unknown'

    if (country == 'Indonesia') {
      var addr = data[0].address_components
      var arr_pos = (addr.length > 4) ? addr.length - 4 : 0
      city = addr[arr_pos].short_name.replace('Kabupaten ', '')
    } else if (data.length > 3) {
      city = data[data.length - 3].address_components[0].short_name
      if ($.isNumeric(city)) city = data[data.length - 2].address_components[0].short_name
    } else {
      city = data[0].address_components[0].short_name
    }

    return city
  }

  WP_Salah._locateAndChangePrayerTime = function (ipData) {
    var params = {
      loc: ipData.loc,
      city: ipData.city
    }

    // get location name from google
    if (params.city == '' || params.city == null) {
      var geocoder = new google.maps.Geocoder()
      var posSplit = ipData.loc.split(',')
      var pos = {
        lat: parseFloat(posSplit[0]),
        lng: parseFloat(posSplit[1])
      }

      geocoder.geocode({
        latLng: pos
      }, function (results, status) {
        if (results && results.length) {
          params.city = WP_Salah._parseGoogleCityName(results)
        } else {
          params.city = 'unknown city'
        }

        WP_Salah.changePrayerTime(params)
      })
    } else {
      WP_Salah.changePrayerTime(params)
    }
  }

  WP_Salah.initPrayerTime = function () {
    // get prayer times data if not exists in cookie
    if (!WP_Salah.changePrayerTimeByCookie()) {
      $.getJSON(wp_salah_config.ajaxurl, {
        action: 'wp_salah_real_ip'
      }, function (realIP) {
        $.getJSON('https://ipinfo.io/' + realIP)
          .done(function (ipData) {
            WP_Salah._locateAndChangePrayerTime(ipData)
          })
          .fail(function () {
            // alternative API: http://www.geoplugin.net/json.gp?ip
            $.getJSON('http://ip-api.com/json/' + realIP)
              .done(function (resp) {
                WP_Salah._locateAndChangePrayerTime({
                  city: resp.city,
                  loc: resp.lat + ',' + resp.lon
                })
              })
              .fail(function () {
                WP_Salah._locateAndChangePrayerTime({
                  city: wp_salah_config.defaultCity.name,
                  loc: wp_salah_config.defaultCity.coordinate
                })
              })
          })
      })
    }

    // prayer time location selector
    $(document).on('click', '.js-wp-salah-change-city', function (e) {
      e.preventDefault()
      swal({
        title: 'Pilih Lokasi',
        html: '<div id="prayer-map" style="width:100%;height:300px;"></div>',
        input: 'text',
        showCancelButton: true
      }).then(function (result) {
        $('.swal2-input').prop('disabled', false)

        if (!result || !result.value) return

        var split = result.value.split(' (')
        var params = {
          city: split[0],
          loc: split[1].replace(')', '')
        }

        WP_Salah.changePrayerTime(params)
      })

      // fill initial value
      $('.swal2-input').prop('disabled', true)
        .val(WP_Salah.prayerTimes.city + ' (' + WP_Salah.prayerTimes.loc + ')')

      var posSplit = WP_Salah.prayerTimes.loc.split(',')
      var pos = {
        lat: parseFloat(posSplit[0]),
        lng: parseFloat(posSplit[1])
      }

      var map = new google.maps.Map(document.getElementById('prayer-map'), {
        center: pos,
        zoom: 6
      })
      var geocoder = new google.maps.Geocoder()
      var marker = new google.maps.Marker({
        position: pos,
        map: map
      })

      function getLocationName (pos) {
        $('.swal2-input').val('Memuat informasi lokasi...')
        $('.swal2-confirm').prop('disabled', true)

        geocoder.geocode({
          latLng: pos
        }, function (results, status) {
          if (results && results.length) {
            var city = WP_Salah._parseGoogleCityName(results)
            var loc = pos.lat + ',' + pos.lng

            $('.swal2-input').val(city + ' (' + loc + ')')

            $('.swal2-confirm').prop('disabled', false)
          } else {
            $('.swal2-input').val('Lokasi tidak tersedia')
          }
        })
      }

      map.addListener('click', function (e) {
        marker.setPosition(e.latLng)
        var pos = {
          lat: e.latLng.lat(),
          lng: e.latLng.lng()
        }
        getLocationName(pos)
      })
    })
  }

  WP_Salah.timerUpdate = function () {
    if (!WP_Salah.prayerTimes) return
    if (!WP_Salah.prayerTimes.offset) return
    if (!WP_Salah.prayerTimes.times) return

    var
      // convert google rawOffset (seconds) to JS TimezoneOffset (minutes)
      tzOffset = -(WP_Salah.prayerTimes.offset / 60)
      // get current time in target timezone, based on local timezone
    var currentDateStr = new Date(
      new ServerDate().getTime() +
        (60000 * (new ServerDate().getTimezoneOffset() - tzOffset)) // minutes to milliseconds
    ) + ''
    var currentTime = (currentDateStr.match(/\d+:\d+/)[0])
    var currentTimeSecond = (currentDateStr.match(/\d+:\d+:\d+/)[0])
    var times = WP_Salah.prayerTimes.times.split(',')
    var riseTime = times.pop() // to calculate fajr time
    var selectedTime = ''
    var nextTime = times[0]

    $.each(times, function (idx, time) {
      if (currentTime > time) { selectedTime = time }
      if (currentTime < time && nextTime == times[0]) { nextTime = time }
    })

    // calculate time diff to nextTime
    var curMatch = currentDateStr.match(/(\d+):(\d+):(\d+)/)
    var curSeconds = (parseInt(curMatch[1]) * 60 * 60) + (parseInt(curMatch[2]) * 60) + parseInt(curMatch[3])
    var nextSeconds = (parseInt(nextTime.split(':')[0]) * 60 * 60) + (parseInt(nextTime.split(':')[1]) * 60)
    var timeDiff = new Date((nextSeconds - curSeconds) * 1000).toISOString().substr(11, 8)

    $('.js-next-prayer').html(timeDiff)

    $('.js-current-time').html(currentTimeSecond)

    // check for sunrise, its not fajr anymore
    if (selectedTime == times[0] && currentTime > riseTime) { selectedTime = '' }

    $('.js-wp-salah-time').parents('tr').removeClass('-active -next')

    if (selectedTime) { $(".js-wp-salah-time:contains('" + selectedTime + "')").parents('tr').addClass('-active') }

    if (nextTime) { $(".js-wp-salah-time:contains('" + nextTime + "')").parents('tr').addClass('-next') }
  }
})(jQuery)
