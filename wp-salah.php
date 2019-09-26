<?php
/**
 * Plugin Name: WP Salah
 * Description: Geo-based Salah time widget
 * Version: 1.0
 * Author: Motekar
 * Author URI: https://bitbucket.org/motekar/
 */

require 'class-wp-salah-widget.php';

class WP_Salah {
	public function __construct() {
		add_action( 'admin_init', [ $this, 'admin_init' ] );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_scripts' ] );
		add_action( 'script_loader_tag', [ $this, 'defer_scripts' ], 10, 3 );
		add_action( 'widgets_init', [ $this, 'widgets_init' ] );
		add_action( 'admin_menu', [ $this, 'create_menu' ] );

		add_action( 'wp_ajax_wp_salah_time', [ $this, 'ajax_get_salah_time' ] );
		add_action( 'wp_ajax_nopriv_wp_salah_time', [ $this, 'ajax_get_salah_time' ] );
		add_action( 'wp_ajax_wp_salah_real_ip', [ $this, 'ajax_get_real_ip' ] );
		add_action( 'wp_ajax_nopriv_wp_salah_real_ip', [ $this, 'ajax_get_real_ip' ] );
	}

	public function admin_init() {
		register_setting( 'wp-salah-settings', 'google_maps_api_key' );
		register_setting( 'wp-salah-settings', 'tzdb_api_key' );
	}

	public function enqueue_scripts() {
		wp_enqueue_script( 'google-maps-api', 'https://maps.googleapis.com/maps/api/js?key=' . get_option( 'google_maps_api_key' ), [], '1.0', false );
		wp_enqueue_script( 'server-date', 'https://cdn.jsdelivr.net/npm/serverdate@3.1.0/lib/ServerDate.min.js', [], '3.1.0', false );
		wp_enqueue_script( 'sweet-alert-2', 'https://cdn.jsdelivr.net/npm/sweetalert2@7.33.1/dist/sweetalert2.all.min.js', [], '7.33.1', false );
		wp_enqueue_script( 'wp-salah-script', plugins_url( 'js/wp-salah.js', __FILE__ ), [ 'jquery' ], '1.0', true );

		wp_localize_script(
			'wp-salah-script',
			'wp_salah_config',
			[
				'ajaxurl'     => admin_url( 'admin-ajax.php' ),
				'keys'        => [
					'google' => get_option( 'google_maps_api_key' ),
					'tzdb'   => get_option( 'tzdb_api_key' ),
				],
				'defaultCity' => [
					'city'       => 'Jakarta',
					'coordinate' => '-6.21462,106.84513',
				],
			]
		);

		wp_enqueue_style( 'wp-salah-style', plugins_url( 'css/wp-salah.css', __FILE__ ), null, '1.0' );
	}

	public function defer_scripts( $tag, $handle, $src ) {
		$deferred = [
			'google-maps-api',
		];

		if ( in_array( $handle, $deferred, true ) ) {
			return '<script src="' . $src . '" defer></script>' . "\n";
		}

		return $tag;
	}

	public function widgets_init() {
		register_widget( 'WP_Salah_Widget' );
	}

	public function create_menu() {
		add_menu_page( 'WP-Salah Settings', 'WP-Salah', 'administrator', 'wp-salah', [ $this, 'settings_page' ] );
	}

	public function settings_page() {
		?>
<div class="wrap">
	<h1>WP-Salah Settings</h1>

	<form action="options.php" method="post">
		<?php settings_fields( 'wp-salah-settings' ); ?>
		<?php do_settings_sections( 'wp-salah-settings' ); ?>
		<table class="form-table">
			<tbody>
				<tr>
					<th scope="row">
						<label for="google_maps_api_key">Google API Key</label>
					</th>
					<td>
						<input type="text" name="google_maps_api_key" id="google_maps_api_key" class="regular-text" placeholder="xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxx" value="<?php echo esc_attr( get_option( 'google_maps_api_key' ) ); ?>">
						<p class="description"><a href="https://developers.google.com/maps/documentation/javascript/get-api-key">https://developers.google.com/maps/documentation/javascript/get-api-key</a></p>
					</td>
				</tr>
				<tr>
					<th scope="row">
						<label for="tzdb_api_key">TimeZoneDB API Key</label>
					</th>
					<td>
						<input type="text" name="tzdb_api_key" id="tzdb_api_key" class="regular-text" placeholder="xxxxxxxxxxxx" value="<?php echo esc_attr( get_option( 'tzdb_api_key' ) ); ?>">
						<p class="description"><a href="https://timezonedb.com/register">https://timezonedb.com/register</a></p>
					</td>
				</tr>
			</tbody>
		</table>
		<?php submit_button(); ?>
	</form>
</div>
		<?php
	}

	public function ajax_get_salah_time() {
		$response = array(
			'status' => 'error',
		);
		header( 'Content-Type: application/json' );

		require 'class-imsakiyah.php';

		$params = array();

		if ( ! empty( $_REQUEST['rawOffset'] ) ) {
			$params['rawOffset'] = $_REQUEST['rawOffset'];
		}

		if ( ! empty( $_REQUEST['location'] ) ) {
			$loc = explode( ',', $_REQUEST['location'] );

			if ( count( $loc ) !== 2 )
				die( 'Invalid location' );

			$params['lintang'] = $loc[0];
			$params['bujur']   = $loc[1];
		}


		try {
			$elevation = json_decode( wp_remote_get( "https://elevation-api.io/api/elevation?points=({$_REQUEST['location']})&key=" . ELEVATION_API_KEY ) );
			$params['ketinggian'] = $elevation->elevations[0]->elevation;
		} catch ( \Throwable $th ) {
			$params['ketinggian'] = 100;
		}

		$prayer_time = new Imsakiyah( $params );

		$times = $prayer_time->getImsakiyah();

		foreach ($times as $key => $value)
			$times[ $key ] = date( 'H:i', $value );

		$response['time'] = $times;
		$response['data'] = $prayer_time;

		$response['status'] = 'success';

		echo wp_json_encode( $response );
		die();
	}

	public function ajax_get_real_ip() {
		$ip = $_SERVER['REMOTE_ADDR'];

		if ( ! empty( $_SERVER['HTTP_CF_CONNECTING_IP'] ) )
			$ip = $_SERVER['HTTP_CF_CONNECTING_IP'];

		if ( ! empty( $_SERVER['HTTP_X_FORWARDED_FOR'] ) )
			$ip = $_SERVER['HTTP_X_FORWARDED_FOR'];

		if ( ! empty( $_SERVER['HTTP_FORWARDED'] ) )
			$ip = $_SERVER['HTTP_FORWARDED'];

		$ip = str_replace( 'for=', '', $ip );

		if ( '127.0.0.1' === $ip ) {
			$ip = wp_remote_get( 'https://ip.seeip.org' );
			$ip = str_replace( "\n", '', $ip );
			// alternative = https://api.ipify.org?format=txt
		}

		echo wp_json_encode( $ip );
		die();
	}
}

new WP_Salah();
