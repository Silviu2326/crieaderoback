import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Mail, Phone, MapPin, LogOut, User } from 'lucide-react-native';
import { ScreenLayout } from '@/components/layout/ScreenLayout';
import { Card } from '@/components/common/Card';
import { useAuth } from '@/hooks/useAuth';

export function ProfileScreen() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <ScreenLayout>
        <View style={styles.center}>
          <Text style={styles.emptyText}>No hay informacion de usuario</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <User size={40} color="#fff" />
        </View>
        <Text style={styles.name}>{user.firstName} {user.lastName}</Text>
        <Text style={styles.role}>{user.role}</Text>
      </View>

      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Mail size={18} color="#8E8E93" />
          <Text style={styles.infoText}>{user.email}</Text>
        </View>
        {user.phone && (
          <View style={styles.infoRow}>
            <Phone size={18} color="#8E8E93" />
            <Text style={styles.infoText}>{user.phone}</Text>
          </View>
        )}
        {(user.address || user.city) && (
          <View style={styles.infoRow}>
            <MapPin size={18} color="#8E8E93" />
            <Text style={styles.infoText}>
              {[user.address, user.city].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}
      </Card>

      <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.7}>
        <LogOut size={20} color="#FF3B30" />
        <Text style={styles.logoutText}>Cerrar sesion</Text>
      </TouchableOpacity>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 15,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  role: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  infoCard: {
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#1C1C1E',
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingVertical: 14,
    backgroundColor: '#FFE5E5',
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
});
