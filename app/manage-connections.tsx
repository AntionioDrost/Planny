import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, UserMinus, ShieldAlert } from 'lucide-react-native';
import { UserAvatar } from '@/components/user-avatar';
import { listConnections, setConnectionStatus } from '@/services/connection-service';

export default function ManageConnectionsScreen() {
    const [loading, setLoading] = useState(true);
    const [connections, setConnections] = useState<any[]>([]);

    useEffect(() => {
        loadConnections();
    }, []);

    const loadConnections = async () => {
        setLoading(true);
        try {
            const data = await listConnections();
            setConnections(data);
        } catch {
            Alert.alert('Error', 'Failed to load connections.');
        }
        setLoading(false);
    };

    const removeConnection = async (connId: string, otherName: string) => {
        Alert.alert(
            "Remove Connection",
            `Are you sure you want to remove ${otherName}? You will no longer share calendar availability.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await setConnectionStatus(connId, 'removed');
                            setConnections(prev => prev.filter(c => c.id !== connId));
                        } catch {
                            Alert.alert('Error', 'Could not remove connection.');
                        }
                    }
                }
            ]
        );
    };

    const toggleLimit = async (connectionId: string, isLimited: boolean) => {
        try {
            await setConnectionStatus(connectionId, isLimited ? 'active' : 'limited');
            setConnections((prev) =>
                prev.map((item) =>
                    item.id === connectionId ? { ...item, status: isLimited ? 'active' : 'limited' } : item
                )
            );
        } catch {
            Alert.alert('Error', 'Could not update connection limit status.');
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color="#FF9500" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color="#111" />
                </TouchableOpacity>
                <Text style={styles.title}>Manage Connections</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                contentContainerStyle={styles.listContainer}
                data={connections}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>No connections yet</Text>
                        <Text style={styles.emptyDesc}>
                            Go to your Profile and tap &quot;Add new connection&quot; to scan a friend&apos;s QR code.
                        </Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardInfo}>
                            <UserAvatar
                                avatarUrl={item.otherUser?.avatar_url}
                                name={item.otherUser?.display_name}
                                size={48}
                                style={styles.avatar}
                            />
                            <View>
                                <Text style={styles.cardTitle}>{item.otherUser?.display_name || 'Unknown User'}</Text>
                                <Text style={styles.cardSubtitle}>Connected since {new Date(item.created_at).toLocaleDateString()}</Text>
                            </View>
                        </View>
                        <View style={styles.cardActions}>
                            <TouchableOpacity
                                style={[styles.iconBtn, item.status === 'limited' && styles.iconBtnLimited]}
                                onPress={() => toggleLimit(item.id, item.status === 'limited')}
                            >
                                <ShieldAlert size={20} color="#666" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.iconBtn, { backgroundColor: '#FFEEED', borderColor: '#FFD1CE' }]}
                                onPress={() => removeConnection(item.id, item.otherUser?.display_name || 'User')}
                            >
                                <UserMinus size={20} color="#D32F2F" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9F9F9',
        paddingTop: 50,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111',
    },
    listContainer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#EAEAEA',
        marginTop: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    emptyDesc: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#EAEAEA',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    cardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        marginRight: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 12,
        color: '#666',
    },
    cardActions: {
        flexDirection: 'row',
        gap: 8,
    },
    iconBtn: {
        padding: 10,
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EAEAEA',
    },
    iconBtnLimited: {
        backgroundColor: '#FFF4E5',
        borderColor: '#FFCC8A',
    },
});
