#!/bin/bash

# Deploy static assets to CDN
# This script helps prepare assets for CDN deployment

echo "🚀 CDN Deployment Helper"
echo "========================"
echo ""

# Check if public/sounds directory exists
if [ ! -d "public/sounds" ]; then
    echo "❌ Error: public/sounds directory not found"
    exit 1
fi

# Count audio files
AUDIO_COUNT=$(ls -1 public/sounds/*.mp3 2>/dev/null | wc -l)
echo "📊 Found $AUDIO_COUNT audio files"

# Calculate total size
TOTAL_SIZE=$(du -sh public/sounds | cut -f1)
echo "💾 Total size: $TOTAL_SIZE"

echo ""
echo "📋 CDN Deployment Options:"
echo ""
echo "1. jsDelivr (GitHub-based, Free)"
echo "   - Create a public GitHub repo for assets"
echo "   - Copy public/sounds to the repo"
echo "   - Push to GitHub"
echo "   - Use URL: https://cdn.jsdelivr.net/gh/username/repo@branch/sounds/"
echo ""
echo "2. Cloudflare R2 (S3-compatible)"
echo "   - Install wrangler: npm install -g wrangler"
echo "   - Create R2 bucket: wrangler r2 bucket create bingo-assets"
echo "   - Upload: wrangler r2 object put bingo-assets/sounds/1.mp3 --file=public/sounds/1.mp3"
echo ""
echo "3. AWS S3 + CloudFront"
echo "   - Install AWS CLI: https://aws.amazon.com/cli/"
echo "   - Create S3 bucket: aws s3 mb s3://bingo-assets"
echo "   - Upload: aws s3 sync public/sounds s3://bingo-assets/sounds/"
echo "   - Create CloudFront distribution"
echo ""
echo "4. Netlify (Automatic)"
echo "   - Deploy to Netlify"
echo "   - Assets automatically served via CDN"
echo "   - No additional setup needed"
echo ""

# Ask user which option they want
read -p "Which CDN option would you like to use? (1-4): " OPTION

case $OPTION in
    1)
        echo ""
        echo "📦 jsDelivr Setup Instructions:"
        echo "1. Create a new public GitHub repository (e.g., 'bingo-assets')"
        echo "2. Clone the repository locally"
        echo "3. Copy audio files:"
        echo "   cp -r public/sounds /path/to/bingo-assets/"
        echo "4. Commit and push:"
        echo "   cd /path/to/bingo-assets"
        echo "   git add ."
        echo "   git commit -m 'Add audio assets'"
        echo "   git push origin main"
        echo "5. Update .env:"
        echo "   VITE_CDN_ENABLED=true"
        echo "   VITE_CDN_BASE_URL=https://cdn.jsdelivr.net/gh/yourusername/bingo-assets@main"
        echo "   VITE_CDN_AUDIO_PATH=/sounds"
        ;;
    2)
        echo ""
        echo "☁️ Cloudflare R2 Setup Instructions:"
        echo "1. Install wrangler: npm install -g wrangler"
        echo "2. Login: wrangler login"
        echo "3. Create bucket: wrangler r2 bucket create bingo-assets"
        echo "4. Upload files (this may take a while)..."
        
        read -p "Do you want to upload now? (y/n): " UPLOAD
        if [ "$UPLOAD" = "y" ]; then
            for file in public/sounds/*.mp3; do
                filename=$(basename "$file")
                echo "Uploading $filename..."
                wrangler r2 object put bingo-assets/sounds/$filename --file=$file
            done
            echo "✅ Upload complete!"
        fi
        
        echo "5. Configure custom domain in Cloudflare dashboard"
        echo "6. Update .env:"
        echo "   VITE_CDN_ENABLED=true"
        echo "   VITE_CDN_BASE_URL=https://your-r2-domain.com"
        echo "   VITE_CDN_AUDIO_PATH=/sounds"
        ;;
    3)
        echo ""
        echo "☁️ AWS S3 + CloudFront Setup Instructions:"
        echo "1. Install AWS CLI: https://aws.amazon.com/cli/"
        echo "2. Configure AWS: aws configure"
        echo "3. Create S3 bucket: aws s3 mb s3://bingo-assets"
        echo "4. Upload files:"
        echo "   aws s3 sync public/sounds s3://bingo-assets/sounds/ --acl public-read"
        echo "5. Create CloudFront distribution in AWS Console"
        echo "6. Update .env:"
        echo "   VITE_CDN_ENABLED=true"
        echo "   VITE_CDN_BASE_URL=https://d1234567890.cloudfront.net"
        echo "   VITE_CDN_AUDIO_PATH=/sounds"
        ;;
    4)
        echo ""
        echo "🌐 Netlify Deployment:"
        echo "Assets are automatically served via CDN when deployed to Netlify."
        echo "No additional CDN configuration needed!"
        echo ""
        echo "Just deploy normally:"
        echo "  npm run build"
        echo "  netlify deploy --prod"
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "✅ Setup instructions provided!"
echo "📖 See CDN_SETUP_GUIDE.md for detailed documentation"
