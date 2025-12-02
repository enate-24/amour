# CDN Setup Guide

## Overview
This guide explains how to configure and use CDN (Content Delivery Network) for static assets in your Bingo application to improve performance and reduce server load.

## Benefits of Using CDN

### Performance
- **Faster load times** - Assets served from geographically closer servers
- **Reduced latency** - Lower time-to-first-byte (TTFB)
- **Better caching** - Browser and edge caching for static assets
- **Parallel downloads** - Multiple concurrent connections

### Cost & Scalability
- **Reduced bandwidth costs** - Offload traffic from your origin server
- **Better scalability** - Handle traffic spikes without server upgrades
- **Global reach** - Serve users worldwide efficiently

### Reliability
- **High availability** - CDN redundancy and failover
- **DDoS protection** - Built-in security features
- **Automatic fallback** - Falls back to local assets if CDN fails

## CDN Options

### 1. jsDelivr (Free, GitHub-based)
**Best for:** Open source projects, GitHub repositories

**Setup:**
1. Push your audio files to a public GitHub repository
2. Use URL format: `https://cdn.jsdelivr.net/gh/username/repo@branch/path/to/file`

**Example:**
```env
VITE_CDN_ENABLED=true
VITE_CDN_BASE_URL=https://cdn.jsdelivr.net/gh/yourusername/bingo-assets@main/public
VITE_CDN_AUDIO_PATH=/sounds
```

**Pros:**
- Free and unlimited
- Global CDN network
- Automatic caching
- No configuration needed

**Cons:**
- Requires public GitHub repo
- 50MB file size limit
- Not suitable for private/sensitive content

### 2. Cloudflare CDN (Free tier available)
**Best for:** Production applications, custom domains

**Setup:**
1. Sign up at https://cloudflare.com
2. Add your domain to Cloudflare
3. Enable CDN caching rules
4. Upload assets to your origin server or R2 storage

**Example:**
```env
VITE_CDN_ENABLED=true
VITE_CDN_BASE_URL=https://assets.yourdomain.com
VITE_CDN_AUDIO_PATH=/sounds
```

**Pros:**
- Free tier with generous limits
- Advanced caching controls
- DDoS protection
- Analytics and monitoring
- Private content support

**Cons:**
- Requires domain setup
- More complex configuration

### 3. AWS CloudFront + S3
**Best for:** Enterprise applications, AWS infrastructure

**Setup:**
1. Create S3 bucket for assets
2. Upload audio files to S3
3. Create CloudFront distribution
4. Configure origin and caching

**Example:**
```env
VITE_CDN_ENABLED=true
VITE_CDN_BASE_URL=https://d1234567890.cloudfront.net
VITE_CDN_AUDIO_PATH=/sounds
```

**Pros:**
- Enterprise-grade performance
- Fine-grained access control
- Integration with AWS services
- Scalable and reliable

**Cons:**
- Costs money (pay-as-you-go)
- More complex setup
- Requires AWS account

### 4. Netlify CDN (Automatic)
**Best for:** Netlify-hosted applications

**Setup:**
1. Deploy to Netlify
2. Assets automatically served via CDN
3. No additional configuration needed

**Note:** If hosting on Netlify, assets are already on CDN. Set `VITE_CDN_ENABLED=false`

## Quick Start Guide

### Step 1: Choose Your CDN Provider
Select a CDN provider based on your needs (see options above)

### Step 2: Upload Audio Files
Upload the contents of `public/sounds/` to your CDN:
- 75 number audio files (1.mp3 - 75.mp3)
- winner.mp3
- shuffle-audio-TfqyAnvz.mp3

### Step 3: Configure Environment Variables
Create or update `.env` file:

```env
# Enable CDN
VITE_CDN_ENABLED=true

# Set your CDN base URL
VITE_CDN_BASE_URL=https://your-cdn-url.com

# Audio path (usually /sounds)
VITE_CDN_AUDIO_PATH=/sounds
```

### Step 4: Test CDN Configuration
1. Build the application: `npm run build`
2. Preview: `npm run preview`
3. Open browser console and check for CDN logs
4. Verify audio files load from CDN (check Network tab)

### Step 5: Deploy
Deploy your application with the new environment variables

## Testing CDN

### Development Testing
```bash
# Set CDN variables in .env
VITE_CDN_ENABLED=true
VITE_CDN_BASE_URL=https://your-test-cdn.com

# Run dev server
npm run dev

# Check console for CDN logs
```

### Production Testing
1. Open browser DevTools → Network tab
2. Filter by "sounds" or "mp3"
3. Check the "Domain" column - should show your CDN URL
4. Verify response headers include CDN cache headers

### Fallback Testing
1. Temporarily set invalid CDN URL
2. Application should fall back to local assets
3. Check console for fallback warnings

## Performance Monitoring

### Key Metrics to Track
- **Audio load time** - Time to download audio files
- **Cache hit rate** - Percentage of requests served from cache
- **Bandwidth usage** - Data transferred from CDN vs origin
- **Error rate** - Failed CDN requests

### Tools
- Browser DevTools Network tab
- CDN provider analytics dashboard
- Lighthouse performance audit
- WebPageTest.org

## Troubleshooting

### Audio Files Not Loading from CDN
**Check:**
1. CDN URL is correct in `.env`
2. Audio files are uploaded to CDN
3. CORS headers are configured on CDN
4. Browser console for error messages

**Solution:**
```bash
# Test CDN URL directly
curl -I https://your-cdn-url.com/sounds/1.mp3

# Should return 200 OK with proper headers
```

### CORS Errors
**Problem:** Browser blocks CDN requests due to CORS policy

**Solution:**
Configure CDN to send CORS headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD
```

### Slow CDN Performance
**Check:**
1. CDN provider's network status
2. Geographic location of CDN edge servers
3. Cache configuration (TTL settings)
4. File compression (gzip/brotli)

### Cache Not Working
**Solution:**
1. Set proper cache headers on CDN
2. Use versioned URLs for cache busting
3. Configure CDN cache rules

## Best Practices

### 1. Use Versioning
Include version in CDN URLs for cache busting:
```
https://cdn.example.com/v1.0.0/sounds/1.mp3
```

### 2. Enable Compression
Ensure CDN serves compressed files (gzip/brotli)

### 3. Set Long Cache TTL
For immutable assets like audio files:
```
Cache-Control: public, max-age=31536000, immutable
```

### 4. Monitor CDN Health
Set up alerts for:
- High error rates
- Slow response times
- Cache hit rate drops

### 5. Have Fallback Strategy
Always configure local fallback:
```typescript
cdnConfig.fallbackToLocal = true
```

### 6. Optimize Audio Files
Before uploading to CDN:
- Compress audio files (reduce bitrate if acceptable)
- Use appropriate format (MP3 is good for compatibility)
- Remove metadata to reduce file size

## Cost Estimation

### jsDelivr
- **Cost:** Free
- **Bandwidth:** Unlimited
- **Best for:** Small to medium projects

### Cloudflare
- **Free tier:** 100GB/month
- **Pro:** $20/month (unlimited bandwidth)
- **Best for:** Most production apps

### AWS CloudFront
- **First 1TB:** ~$0.085/GB
- **Next 10TB:** ~$0.080/GB
- **Best for:** Enterprise with AWS infrastructure

## Migration Checklist

- [ ] Choose CDN provider
- [ ] Create CDN account/setup
- [ ] Upload audio files to CDN
- [ ] Configure CORS on CDN
- [ ] Set cache headers
- [ ] Update `.env` with CDN URLs
- [ ] Test in development
- [ ] Test fallback mechanism
- [ ] Deploy to staging
- [ ] Monitor performance
- [ ] Deploy to production
- [ ] Set up monitoring/alerts

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify CDN configuration in `.env`
3. Test CDN URLs directly in browser
4. Check CDN provider's status page
5. Review this guide's troubleshooting section

## Additional Resources

- [jsDelivr Documentation](https://www.jsdelivr.com/documentation)
- [Cloudflare CDN Guide](https://developers.cloudflare.com/cache/)
- [AWS CloudFront Guide](https://docs.aws.amazon.com/cloudfront/)
- [MDN: HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
