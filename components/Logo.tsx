import React from 'react';
import { View, StyleSheet } from 'react-native';

interface LogoProps {
    size?: number;
    color?: string;
    strokeWidth?: number;
}

export const Logo: React.FC<LogoProps> = ({
    size = 100,
    color = '#000',
    strokeWidth = 3,
}) => {
    // The two overlapping circles in the prompt
    // One is large (top right), one is smaller (bottom left)
    const largeCircleSize = size * 0.7;
    const smallCircleSize = size * 0.45;

    return (
        <View style={{ width: size, height: size, position: 'relative' }}>
            {/* Large circle */}
            <View style={[
                styles.circle,
                {
                    width: largeCircleSize,
                    height: largeCircleSize,
                    borderRadius: largeCircleSize / 2,
                    borderColor: color,
                    borderWidth: strokeWidth,
                    position: 'absolute',
                    top: 0,
                    right: 0,
                }
            ]} />

            {/* Small circle */}
            <View style={[
                styles.circle,
                {
                    width: smallCircleSize,
                    height: smallCircleSize,
                    borderRadius: smallCircleSize / 2,
                    borderColor: color,
                    borderWidth: strokeWidth,
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    backgroundColor: '#fff', // to cover the line of the large circle underneath
                }
            ]} />
        </View>
    );
};

const styles = StyleSheet.create({
    circle: {
        backgroundColor: 'transparent',
    }
});
