import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// SECURITY: Restrict CORS to known origins only
const ALLOWED_ORIGINS = [
  "https://hesabaty-sd.netlify.app",
  "https://hesapaty.lovable.app",
  "http://localhost:5173",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const _origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(_origin);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: Verify caller is an authenticated Hisabaty user
  // This prevents unauthenticated abuse of AI credits
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'غير مصرح' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const { createClient: _createClient } = await import('https://esm.sh/@supabase/supabase-js@2.49.1');
    const authClient = _createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'غير مصرح — جلسة منتهية أو غير صالحة' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (authCheckError) {
    console.error('Auth check failed:', authCheckError);
    return new Response(
      JSON.stringify({ success: false, error: 'خطأ في التحقق من الهوية' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { imageUrl, imageBase64, transferId } = await req.json();

    if (!imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'يجب توفير رابط الصورة أو البيانات' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Prepare image content for the AI
    let imageContent;
    if (imageBase64) {
      imageContent = {
        type: "image_url",
        image_url: {
          url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
        }
      };
    } else {
      imageContent = {
        type: "image_url",
        image_url: {
          url: imageUrl
        }
      };
    }

    console.log('Sending image to AI for extraction...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `أنت مساعد متخصص في استخراج بيانات التحويلات المالية من صور إشعارات الدفع.
مهمتك هي تحليل الصورة واستخراج المعلومات التالية بدقة:
1. مبلغ التحويل (الرقم فقط بدون عملة)
2. تاريخ التحويل (بصيغة YYYY-MM-DD)
3. اسم المرسل إن وجد
4. رقم المعاملة/المرجع إن وجد

يجب أن ترد بصيغة JSON فقط بدون أي نص إضافي:
{
  "amount": number | null,
  "date": "YYYY-MM-DD" | null,
  "sender_name": "string" | null,
  "reference_number": "string" | null,
  "confidence": number (0-100)
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'قم بتحليل صورة إشعار التحويل هذه واستخرج البيانات المطلوبة:'
              },
              imageContent
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'يرجى إضافة رصيد للاستمرار في استخدام الذكاء الاصطناعي' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    console.log('AI Response:', content);

    // Parse the JSON response from AI
    let extractedData;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      extractedData = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'فشل في تحليل استجابة الذكاء الاصطناعي',
          rawResponse: content 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If transferId is provided, update the transfer in the database
    if (transferId && extractedData.amount) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { error: updateError } = await supabase
        .from('transfers')
        .update({
          amount: extractedData.amount,
          transfer_date: extractedData.date || new Date().toISOString().split('T')[0],
        })
        .eq('id', transferId);

      if (updateError) {
        console.error('Failed to update transfer:', updateError);
      } else {
        console.log('Transfer updated successfully');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Extract transfer error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
