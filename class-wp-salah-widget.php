<?php
class WP_Salah_Widget extends WP_Widget {
	public function __construct() {
		$widget_options = [
			'classname'   => 'wp-salah-widget',
			'description' => 'Geo-based Salah time widget.',
		];
		parent::__construct( 'wp_salah_widget', 'WP Salah Widget', $widget_options );
	}

	public function widget( $args, $instance ) {
		$title = apply_filters( 'widget_title', $instance['title'] );

		echo $args['before_widget'];
		if ( ! empty( $instance['title'] ) )
			echo $args['before_title'] . $title . $args['after_title'];
		?>
		<table class="wp-salah-time-table" width="100%">
			<tr>
				<th colspan="2">
					<a href="#" class="js-wp-salah-change-city">
						<span class="city-name">...</span>
					</a>
				</th>
			</tr>
			<?php foreach ( [ 'shubuh', 'dzuhur', 'ashar', 'maghrib', 'isya' ] as $key ): ?>
			<tr>
				<td>
					<span class="name"><?php echo ucfirst( $key ); ?></span><br>
				</td>
				<td class="time">
					<span class="number js-wp-salah-time" id="prayer-number-<?php echo $key; ?>">...</span>
				</td>
			</tr>
			<?php endforeach; ?>
		</table>
		<?php
		echo $args['after_widget'];
	}

	public function form( $instance ) {
		$title = ! empty( $instance['title'] ) || '' === $instance['title'] ? $instance['title'] : 'Salah Time';
		?>
		<p>
			<label for="<?php echo esc_attr( $this->get_field_id( 'title' ) ); ?>">
				<?php esc_html_e( 'Title:' ); ?>
				<input
					class="widefat"
					type="text"
					name="<?php echo esc_attr( $this->get_field_name( 'title' ) ); ?>"
					id="<?php echo esc_attr( $this->get_field_id( 'title' ) ); ?>"
					value="<?php echo esc_attr( $title ); ?>">
			</label>
		</p>
		<?php
	}

	public function update( $new_instance, $old_instance ) {
		$instance = $old_instance;
		$instance['title'] = wp_strip_all_tags( $new_instance['title'] );
		return $instance;
	}
}
