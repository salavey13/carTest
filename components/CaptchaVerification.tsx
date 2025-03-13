"use client"
import { useState, useEffect } from 'react'
import { useTelegram } from '@/hooks/useTelegram' // Custom hook for user and admin status
import { supabaseAdmin } from '@/hooks/supabase' // Supabase client for database operations
import toast from 'react-hot-toast' // For user feedback

// Utility function to generate CAPTCHA string
const generateCaptchaString = (length: number, characterSet: 'letters' | 'numbers' | 'both') => {
  let chars = ''
  if (characterSet === 'letters' || characterSet === 'both') {
    chars += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  }
  if (characterSet === 'numbers' || characterSet === 'both') {
    chars += '0123456789'
  }
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Database functions
const getCaptchaSettings = async () => {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('string_length, character_set')
    .eq('id', 1)
    .single()
  if (error) throw error
  return data
}

const updateCaptchaSettings = async (settings: { string_length: number; character_set: string }) => {
  const { error } = await supabaseAdmin
    .from('settings')
    .update(settings)
    .eq('id', 1)
  if (error) throw error
}

export default function CaptchaVerification() {
  const { dbUser, isLoading, isAdmin } = useTelegram()
  const [settings, setSettings] = useState<{ string_length: number; character_set: string } | null>(null)
  const [editingSettings, setEditingSettings] = useState(settings)
  const [captchaString, setCaptchaString] = useState('')
  const [userInput, setUserInput] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')
  const [successfulUsers, setSuccessfulUsers] = useState<any[]>([])

  // Fetch settings and generate CAPTCHA on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getCaptchaSettings()
        setSettings(data)
        setEditingSettings(data) // Initialize editing settings
        const newCaptcha = generateCaptchaString(data.string_length, data.character_set)
        setCaptchaString(newCaptcha)
      } catch (err) {
        console.error('Error fetching settings:', err)
        toast.error('Failed to load CAPTCHA settings.')
      }
    }
    fetchSettings()
  }, [])

  // Check if user has already completed CAPTCHA
  useEffect(() => {
    if (dbUser && !isLoading) {
      const metadata = dbUser.metadata as any
      if (metadata?.captchaSuccess) {
        setIsSuccess(true)
      }
    }
  }, [dbUser, isLoading])

  // Fetch successful users for admin panel
  useEffect(() => {
    if (isAdmin()) {
      const fetchSuccessfulUsers = async () => {
        try {
          const { data, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .filter('metadata->captchaSuccess', 'eq', true)
          if (error) throw error
          setSuccessfulUsers(data || [])
        } catch (err) {
          console.error('Error fetching successful users:', err)
          toast.error('Failed to load successful users.')
        }
      }
      fetchSuccessfulUsers()
    }
  }, [isAdmin])

  // Handle CAPTCHA submission
  const handleSubmit = async () => {
    if (userInput.toLowerCase() === captchaString.toLowerCase()) {
      try {
        const currentMetadata = dbUser.metadata || {}
        const updatedMetadata = { ...currentMetadata, captchaSuccess: true }
        await supabaseAdmin
          .from('users')
          .update({ metadata: updatedMetadata })
          .eq('user_id', dbUser.user_id)
        setIsSuccess(true)
        toast.success('CAPTCHA completed successfully!')
      } catch (err) {
        console.error('Error updating metadata:', err)
        toast.error('Failed to update status. Try again.')
      }
    } else {
      setError('Incorrect CAPTCHA. Please try again.')
      setUserInput('') // Clear input for retry
    }
  }

  // Handle saving settings in admin panel
  const handleSaveSettings = async () => {
    try {
      await updateCaptchaSettings(editingSettings)
      setSettings(editingSettings)
      const newCaptcha = generateCaptchaString(editingSettings.string_length, editingSettings.character_set)
      setCaptchaString(newCaptcha) // Regenerate CAPTCHA with new settings
      toast.success('Settings updated successfully!')
    } catch (err) {
      console.error('Error updating settings:', err)
      toast.error('Failed to update settings. Try again.')
    }
  }

  // Handle sending notifications to successful users
  const handleNotify = async () => {
    try {
      // Assuming notifyCaptchaSuccess exists and takes a list of users
      await notifyCaptchaSuccess(successfulUsers)
      toast.success('Notifications sent successfully!')
    } catch (err) {
      console.error('Error sending notifications:', err)
      toast.error('Failed to send notifications. Try again.')
    }
  }

  // Loading state
  if (isLoading || !settings) {
    return <div>Loading...</div>
  }

  // Login check
  if (!dbUser) {
    return <div>Please log in to proceed.</div>
  }

  return (
    <div className="captcha-container">
      {isSuccess ? (
        <div className="success-message">CAPTCHA completed successfully!</div>
      ) : (
        <div className="captcha-challenge">
          <p>Please enter the following text: <strong>{captchaString}</strong></p>
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Enter CAPTCHA here"
          />
          <button onClick={handleSubmit}>Submit</button>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {isAdmin() && (
        <div className="admin-panel">
          <h2>Admin Panel</h2>
          
          {/* CAPTCHA Settings */}
          <div className="settings-section">
            <h3>CAPTCHA Settings</h3>
            <label>
              String Length:
              <input
                type="number"
                min="4"
                max="8"
                value={editingSettings.string_length}
                onChange={(e) => setEditingSettings({ ...editingSettings, string_length: parseInt(e.target.value) })}
              />
            </label>
            <label>
              Character Set:
              <select
                value={editingSettings.character_set}
                onChange={(e) => setEditingSettings({ ...editingSettings, character_set: e.target.value as 'letters' | 'numbers' | 'both' })}
              >
                <option value="letters">Letters</option>
                <option value="numbers">Numbers</option>
                <option value="both">Both</option>
              </select>
            </label>
            <button onClick={handleSaveSettings}>Save Settings</button>
          </div>

          {/* Success Checker */}
          <div className="success-checker">
            <h3>Successful Users</h3>
            {successfulUsers.length > 0 ? (
              <>
                <ul>
                  {successfulUsers.map((user) => (
                    <li key={user.user_id}>{user.full_name || user.username || user.user_id}</li>
                  ))}
                </ul>
                <button onClick={handleNotify}>Notify Successful Users</button>
              </>
            ) : (
              <p>No users have completed the CAPTCHA yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Placeholder for notification function (to be implemented elsewhere)
const notifyCaptchaSuccess = async (users: any[]) => {
  // Implementation depends on your notification system (e.g., Telegram API)
  console.log('Notifying users:', users)
}
