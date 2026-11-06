import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { User } from '@/types'

interface AuthContextType {
  user: User | null
  role: 'admin' | 'recepcao' | null
  isAdmin: boolean
  isRecepcao: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const mapRecordToUser = (record: any): User => {
    return {
      id: record.id,
      email: record.email || '',
      name: record.name || record.email?.split('@')[0] || 'Usuário',
      role: (record.role as 'admin' | 'recepcao') || 'recepcao',
      avatar: record.avatar,
      created: record.created,
      updated: record.updated,
    }
  }

  const loadInitialAuth = async () => {
    try {
      if (pb.authStore.isValid && pb.authStore.record) {
        // Refresh token if needed
        const authData = await pb.collection('users').authRefresh()
        setUser(mapRecordToUser(authData.record))
      } else {
        setUser(null)
      }
    } catch {
      pb.authStore.clear()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInitialAuth()

    const unsubscribe = pb.authStore.onChange(() => {
      if (pb.authStore.isValid && pb.authStore.record) {
        setUser(mapRecordToUser(pb.authStore.record))
      } else {
        setUser(null)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string): Promise<User> => {
    const authData = await pb.collection('users').authWithPassword(email.trim(), password)
    const mapped = mapRecordToUser(authData.record)
    setUser(mapped)
    return mapped
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const refreshUser = async () => {
    if (pb.authStore.isValid && pb.authStore.record) {
      try {
        const record = await pb.collection('users').getOne(pb.authStore.record.id)
        setUser(mapRecordToUser(record))
      } catch (err) {
        console.error('Error refreshing user:', err)
      }
    }
  }

  const role = user?.role || null
  const isAdmin = role === 'admin'
  const isRecepcao = role === 'recepcao'

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        isRecepcao,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
